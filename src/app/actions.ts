"use server";

import { revalidatePath } from "next/cache";
import type { MediaSource, MediaType, RatingScale } from "@/generated/prisma/enums";
import { parseDay, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { isStatus, type Status } from "@/lib/labels";
import { getDetails } from "@/lib/sources";
import { getEpisodeInfo } from "@/lib/sources/episodes";
import { getCurrentUser } from "@/lib/user";

type MediaRef = { source: MediaSource; type: MediaType; externalId: string };

function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" && v.length > 0 ? v : null;
}

function revalidateAll() {
  revalidatePath("/list");
  revalidatePath("/search");
}

/** Full details for the modal, plus a summary of the user's posts for this title. */
export async function getMediaDetails(ref: MediaRef) {
  const [details, user] = await Promise.all([
    getDetails(ref.source, ref.type, ref.externalId),
    getCurrentUser(),
  ]);
  const entries = await db.entry.findMany({
    where: {
      userId: user.id,
      media: { source: ref.source, externalId: ref.externalId, type: ref.type },
    },
    select: { status: true },
    orderBy: { updatedAt: "desc" },
  });
  const tracked = entries.length
    ? {
        latestStatus: entries[0].status,
        completions: entries.filter((e) => e.status === "COMPLETED").length,
      }
    : null;
  return { details, tracked };
}

/**
 * Adds a post for a title. Logging a completion finishes the title's open
 * post (planning / in progress / paused) if there is one; otherwise it
 * creates a new post, so earlier completions stay as they were.
 */
export async function addToList(
  ref: MediaRef & {
    status?: Status;
    finishedAt?: string | null;
    allAchievements?: boolean;
  },
) {
  const user = await getCurrentUser();
  // Fetch metadata on the server rather than trusting what the client sends.
  const d = await getDetails(ref.source, ref.type, ref.externalId);

  const fields = {
    type: d.type,
    title: d.title,
    posterUrl: d.posterUrl,
    overview: d.overview,
    year: d.year,
    totalUnits: d.totalUnits,
  };
  const media = await db.media.upsert({
    where: { source_externalId: { source: d.source, externalId: d.externalId } },
    update: fields,
    create: { source: d.source, externalId: d.externalId, ...fields },
  });

  const status: Status = isStatus(ref.status) ? ref.status : "PLANNING";
  const completed = status === "COMPLETED";
  const finishedAt = completed ? (parseDay(ref.finishedAt) ?? today()) : null;
  const allAchievements = completed && media.type === "GAME" && Boolean(ref.allAchievements);

  const open = await db.entry.findFirst({
    where: {
      userId: user.id,
      mediaId: media.id,
      status: { in: ["PLANNING", "IN_PROGRESS", "PAUSED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (open) {
    if (open.status === status) return;
    await db.entry.update({
      where: { id: open.id },
      data: {
        status,
        finishedAt,
        allAchievements,
        progress: completed && media.totalUnits ? media.totalUnits : open.progress,
        startedAt: open.startedAt ?? (status === "IN_PROGRESS" ? today() : null),
      },
    });
    await db.activity.create({
      data: { userId: user.id, entryId: open.id, action: `status:${status}` },
    });
    revalidateAll();
    return;
  }

  const entry = await db.entry.create({
    data: {
      userId: user.id,
      mediaId: media.id,
      status,
      progress: completed && media.totalUnits ? media.totalUnits : 0,
      // A start date is only implied when they're starting it now.
      startedAt: status === "IN_PROGRESS" ? today() : null,
      finishedAt,
      allAchievements,
    },
  });
  await db.activity.create({
    data: { userId: user.id, entryId: entry.id, action: completed ? "status:COMPLETED" : "added" },
  });

  revalidateAll();
}

export async function updateEntry(form: FormData) {
  const user = await getCurrentUser();
  const id = str(form, "id")!;
  const entry = await db.entry.findFirst({
    where: { id, userId: user.id },
    include: { media: { select: { totalUnits: true, type: true } } },
  });
  if (!entry) return;

  const statusInput = str(form, "status");
  const status = isStatus(statusInput) ? statusInput : entry.status;
  const becameCompleted = status === "COMPLETED" && entry.status !== "COMPLETED";

  const rating = str(form, "rating");
  const progressInput = str(form, "progress");
  let progress = progressInput ? Math.max(0, Number(progressInput)) : 0;
  if (becameCompleted && entry.media.totalUnits) progress = entry.media.totalUnits;

  // Dates: use what the user typed. If the field was left empty, fill it in
  // automatically when the status implies it (started / completed).
  let startedAt = form.has("startedAt") ? parseDay(str(form, "startedAt")) : entry.startedAt;
  if (status === "IN_PROGRESS" && entry.status === "PLANNING" && !startedAt) startedAt = today();
  let finishedAt = form.has("finishedAt") ? parseDay(str(form, "finishedAt")) : entry.finishedAt;
  if (status === "COMPLETED" && !finishedAt) finishedAt = today();

  await db.entry.update({
    where: { id },
    data: {
      status,
      rating: rating ? Math.min(10, Math.max(1, Number(rating))) : null,
      progress,
      startedAt,
      finishedAt,
      allAchievements: entry.media.type === "GAME" && form.get("allAchievements") === "on",
    },
  });

  if (status !== entry.status) {
    await db.activity.create({
      data: { userId: user.id, entryId: id, action: `status:${status}` },
    });
  }

  revalidateAll();
}

export async function removeEntry(id: string) {
  const user = await getCurrentUser();
  await db.entry.deleteMany({ where: { id, userId: user.id } });
  revalidateAll();
}

export async function updateRatingScale(scale: RatingScale) {
  if (scale !== "TEN" && scale !== "FIVE_STARS") return;
  const user = await getCurrentUser();
  await db.user.update({ where: { id: user.id }, data: { ratingScale: scale } });
  revalidatePath("/list");
  revalidatePath("/settings");
}

/**
 * The +1 button: bumps an in-progress show's episode count and logs the
 * episode as its own post. Watching the final episode completes the show.
 */
export async function logNextEpisode(entryId: string) {
  const user = await getCurrentUser();
  const entry = await db.entry.findFirst({
    where: { id: entryId, userId: user.id },
    include: { media: true },
  });
  if (!entry || (entry.media.type !== "ANIME" && entry.media.type !== "TV")) return null;

  const episode = entry.progress + 1;
  const total = entry.media.totalUnits;
  if (total && episode > total) return null;

  const info = await getEpisodeInfo(entry.media.source, entry.media.externalId, episode);
  const finished = total !== null && episode === total;

  await db.$transaction([
    db.episodeLog.create({
      data: {
        userId: user.id,
        entryId: entry.id,
        mediaId: entry.mediaId,
        episode,
        season: info.season,
        seasonEpisode: info.seasonEpisode,
        title: info.title,
      },
    }),
    db.entry.update({
      where: { id: entry.id },
      data: {
        progress: episode,
        startedAt: entry.startedAt ?? today(),
        ...(finished && { status: "COMPLETED", finishedAt: today() }),
      },
    }),
    db.activity.create({
      data: {
        userId: user.id,
        entryId: entry.id,
        action: finished ? "status:COMPLETED" : `episode:${episode}`,
      },
    }),
  ]);

  revalidateAll();
  return { episode, title: info.title, finished };
}

/** Removes an episode post. Undoing the latest episode also rolls progress back. */
export async function removeEpisodeLog(id: string) {
  const user = await getCurrentUser();
  const log = await db.episodeLog.findFirst({
    where: { id, userId: user.id },
    include: { entry: true },
  });
  if (!log) return;

  await db.episodeLog.delete({ where: { id } });
  if (log.entry.progress === log.episode) {
    await db.entry.update({
      where: { id: log.entryId },
      data: { progress: log.episode - 1 },
    });
  }
  revalidateAll();
}

/** Changes when an episode post says it was watched. */
export async function updateEpisodeWatchedAt(id: string, watchedAt: string) {
  const date = new Date(watchedAt);
  if (Number.isNaN(date.getTime())) return;
  const user = await getCurrentUser();
  await db.episodeLog.updateMany({ where: { id, userId: user.id }, data: { watchedAt: date } });
  revalidatePath("/list");
}
