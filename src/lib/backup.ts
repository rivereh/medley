import "server-only";
import { db } from "./db";
import { isStatus, isType } from "./labels";

// Export/import of everything on a user's list as one JSON file.
//
// Titles are stored once in `media` with a key like "ANILIST:154587"; entries
// and episodes point at that key, and episodes point at their entry's export
// id. Import rebuilds everything with fresh ids, so a file can be imported
// into any Medley database (including a brand-new one).

export const BACKUP_FORMAT = "medley-export";
export const BACKUP_VERSION = 1;

const SOURCES = ["TMDB", "ANILIST", "IGDB"] as const;
const SCALES = ["TEN", "FIVE_STARS"] as const;

type Source = (typeof SOURCES)[number];

const mediaKey = (m: { source: string; externalId: string }) => `${m.source}:${m.externalId}`;

export async function buildBackup(userId: string) {
  const [user, entries, episodes] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.entry.findMany({ where: { userId }, include: { media: true }, orderBy: { createdAt: "asc" } }),
    db.episodeLog.findMany({
      where: { userId },
      include: { media: true },
      orderBy: { watchedAt: "asc" },
    }),
  ]);

  const media = new Map<string, (typeof entries)[number]["media"]>();
  for (const { media: m } of [...entries, ...episodes]) media.set(mediaKey(m), m);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: { ratingScale: user.ratingScale },
    media: [...media.entries()].map(([key, m]) => ({
      key,
      source: m.source,
      externalId: m.externalId,
      type: m.type,
      title: m.title,
      posterUrl: m.posterUrl,
      year: m.year,
      overview: m.overview,
      totalUnits: m.totalUnits,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      media: mediaKey(e.media),
      status: e.status,
      rating: e.rating,
      progress: e.progress,
      allAchievements: e.allAchievements,
      notes: e.notes,
      startedAt: e.startedAt,
      finishedAt: e.finishedAt,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    episodes: episodes.map((l) => ({
      entry: l.entryId,
      media: mediaKey(l.media),
      episode: l.episode,
      season: l.season,
      seasonEpisode: l.seasonEpisode,
      title: l.title,
      watchedAt: l.watchedAt,
      createdAt: l.createdAt,
    })),
  };
}

// --- Import ---------------------------------------------------------------

export class BackupError extends Error {}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);
function date(v: unknown) {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function list(data: Obj, key: string): Obj[] {
  const v = data[key];
  if (!Array.isArray(v) || !v.every(isObj)) throw new BackupError(`"${key}" is missing or invalid.`);
  return v;
}

export type ImportResult = {
  titles: number;
  entriesAdded: number;
  entriesSkipped: number;
  episodesAdded: number;
  episodesSkipped: number;
};

/**
 * Imports a backup. By default it merges: anything already on the list
 * (same title, status and dates) is skipped, so importing the same file twice
 * is harmless. With `replace`, the current list is cleared first.
 */
export async function importBackup(
  userId: string,
  data: unknown,
  { replace = false } = {},
): Promise<ImportResult> {
  if (!isObj(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupError("This doesn't look like a Medley export file.");
  }
  if (typeof data.version !== "number" || data.version > BACKUP_VERSION) {
    throw new BackupError("This export is from a newer version of Medley. Update Medley and try again.");
  }
  const media = list(data, "media");
  const entries = list(data, "entries");
  const episodes = list(data, "episodes");

  const result: ImportResult = {
    titles: 0,
    entriesAdded: 0,
    entriesSkipped: 0,
    episodesAdded: 0,
    episodesSkipped: 0,
  };

  await db.$transaction(async (tx) => {
    if (replace) {
      await tx.episodeLog.deleteMany({ where: { userId } });
      await tx.entry.deleteMany({ where: { userId } });
    }

    const scale = isObj(data.settings) ? data.settings.ratingScale : null;
    if (SCALES.includes(scale as (typeof SCALES)[number])) {
      await tx.user.update({
        where: { id: userId },
        data: { ratingScale: scale as (typeof SCALES)[number] },
      });
    }

    // Titles: upsert by source + external id; remember each key's database id.
    const mediaIds = new Map<string, string>();
    for (const m of media) {
      const source = str(m.source) as Source | null;
      const externalId = str(m.externalId);
      const title = str(m.title);
      if (!source || !SOURCES.includes(source) || !externalId || !title || !isType(m.type)) continue;
      const fields = {
        type: m.type,
        title,
        posterUrl: str(m.posterUrl),
        year: int(m.year),
        overview: str(m.overview),
        totalUnits: int(m.totalUnits),
      };
      const row = await tx.media.upsert({
        where: { source_externalId: { source, externalId } },
        update: fields,
        create: { source, externalId, ...fields },
      });
      mediaIds.set(str(m.key) ?? mediaKey({ source, externalId }), row.id);
      result.titles++;
    }

    // Entries: the export's entry id -> the id it has in this database.
    const entryIds = new Map<string, string>();
    for (const e of entries) {
      const mediaId = mediaIds.get(str(e.media) ?? "");
      if (!mediaId || !isStatus(e.status)) continue;
      const fields = {
        status: e.status,
        rating: int(e.rating),
        progress: int(e.progress) ?? 0,
        allAchievements: e.allAchievements === true,
        notes: str(e.notes),
        startedAt: date(e.startedAt),
        finishedAt: date(e.finishedAt),
        createdAt: date(e.createdAt) ?? new Date(),
        updatedAt: date(e.updatedAt) ?? new Date(),
      };

      const existing = replace
        ? null
        : await tx.entry.findFirst({
            where: {
              userId,
              mediaId,
              status: fields.status,
              finishedAt: fields.finishedAt,
              createdAt: fields.createdAt,
            },
          });
      let id: string;
      if (existing) {
        id = existing.id;
        result.entriesSkipped++;
      } else {
        id = (await tx.entry.create({ data: { userId, mediaId, ...fields } })).id;
        result.entriesAdded++;
      }
      const exportId = str(e.id);
      if (exportId) entryIds.set(exportId, id);
    }

    for (const l of episodes) {
      const entryId = entryIds.get(str(l.entry) ?? "");
      const mediaId = mediaIds.get(str(l.media) ?? "");
      const episode = int(l.episode);
      const watchedAt = date(l.watchedAt);
      if (!entryId || !mediaId || episode === null || !watchedAt) continue;

      const existing = replace
        ? null
        : await tx.episodeLog.findFirst({ where: { userId, entryId, episode, watchedAt } });
      if (existing) {
        result.episodesSkipped++;
        continue;
      }
      await tx.episodeLog.create({
        data: {
          userId,
          entryId,
          mediaId,
          episode,
          season: int(l.season),
          seasonEpisode: int(l.seasonEpisode),
          title: str(l.title),
          watchedAt,
          createdAt: date(l.createdAt) ?? watchedAt,
        },
      });
      result.episodesAdded++;
    }
  });

  return result;
}
