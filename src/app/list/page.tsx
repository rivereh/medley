import Link from "next/link";
import { Suspense } from "react";
import { type CompletionNumber, EntryCard } from "@/components/entry-card";
import { ChapterCard, type ChapterPost } from "@/components/chapter-card";
import { EpisodeCard } from "@/components/episode-card";
import { InProgressCard } from "@/components/in-progress-card";
import { ListSearch } from "@/components/list-search";
import { UrlSelect } from "@/components/url-select";
import type { ChapterLog, Entry, EpisodeLog, Media } from "@/generated/prisma/client";
import { postDate, toDay } from "@/lib/dates";
import { db } from "@/lib/db";
import { isStatus, isType, STATUS_LABELS, tracksStart, TYPE_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/lib/user";

// My list mixes several kinds of posts: entries (planning / completed / …),
// episode logs from the +1 button, a book's chapters read in a day, and the
// earlier steps of an entry that has moved on: its planning post, and for
// games and books its started post. They're merged and sorted together here.
type EntryItem = Entry & { media: Media };
type EpisodeItem = EpisodeLog & { media: Media };
type Item =
  | { kind: "entry" | "planned" | "started"; id: string; entry: EntryItem }
  | { kind: "episode"; id: string; log: EpisodeItem }
  | { kind: "chapters"; id: string; reading: ChapterPost };

type SortValue = Date | number | string | null;
/** When each entry post was logged, by item id (see getPostTimes). */
type LoggedAt = Map<string, Date>;
type PostTimes = { hoverTimes: LoggedAt; loggedAt: LoggedAt };
type Pickers = {
  entry: (e: EntryItem) => SortValue;
  planned: (e: EntryItem) => SortValue;
  started: (e: EntryItem) => SortValue;
  episode: (l: EpisodeItem) => SortValue;
  chapters: (c: ChapterPost) => SortValue;
};

function pick(i: Item, p: Pickers) {
  if (i.kind === "episode") return p.episode(i.log);
  if (i.kind === "chapters") return p.chapters(i.reading);
  return p[i.kind](i.entry);
}
const none = () => null;

const SORTS = {
  completed: {
    label: "Date",
    value: (i: Item) =>
      pick(i, {
        entry: postDate,
        planned: (e) => e.plannedAt,
        started: (e) => e.startedAt,
        // Days only: posts on the same day are then ordered by time (postTime).
        episode: (l) => toDay(l.watchedAt),
        chapters: (c) => toDay(c.readAt),
      }),
  },
  added: {
    label: "Date added",
    // When the post itself was logged, so completing something planned long
    // ago still puts its completion at the top.
    value: (i: Item, times: PostTimes) =>
      i.kind === "episode"
        ? i.log.createdAt
        : i.kind === "chapters"
          ? i.reading.createdAt
          : (times.loggedAt.get(i.id) ?? i.entry.createdAt),
  },
  updated: {
    label: "Recently updated",
    value: (i: Item) =>
      pick(i, {
        entry: (e) => e.updatedAt,
        planned: (e) => e.plannedAt,
        started: (e) => e.startedAt,
        episode: (l) => l.watchedAt,
        chapters: (c) => c.readAt,
      }),
  },
  started: {
    label: "Start date",
    value: (i: Item) =>
      pick(i, {
        entry: (e) => e.startedAt,
        planned: none,
        started: (e) => e.startedAt,
        episode: none,
        chapters: none,
      }),
  },
  rating: {
    label: "Rating",
    value: (i: Item) =>
      pick(i, { entry: (e) => e.rating, planned: none, started: none, episode: none, chapters: none }),
  },
  title: {
    label: "Title (A–Z)",
    value: (i: Item) =>
      pick(i, {
        entry: (e) => e.media.title,
        planned: (e) => e.media.title,
        started: (e) => e.media.title,
        episode: (l) => l.media.title,
        chapters: (c) => c.media.title,
      }),
  },
} satisfies Record<string, { label: string; value: (i: Item, times: PostTimes) => SortValue }>;

type SortKey = keyof typeof SORTS;
const DEFAULT_SORT: SortKey = "completed";

/**
 * When a post happened, to order posts that tie (e.g. on the same day): the
 * time its status was logged, or for older posts without one, when the entry
 * was last changed. An entry's earlier steps sort below it.
 */
function postTime(i: Item, times: PostTimes) {
  if (i.kind === "episode") return i.log.watchedAt.getTime();
  if (i.kind === "chapters") return i.reading.readAt.getTime();
  const logged = times.hoverTimes.get(i.id) ?? times.loggedAt.get(i.id);
  if (logged) return logged.getTime();
  if (i.kind === "entry") return i.entry.updatedAt.getTime();
  return i.entry.createdAt.getTime() - (i.kind === "planned" ? 2 : 1);
}

/**
 * The posts an entry contributes to "All". Unfinished shows/anime are tracked
 * by the In Progress row and their episode posts, so their own post only shows
 * once completed (their status tabs still list them for editing).
 */
function feedPosts(entry: EntryItem): Item[] {
  const posts: Item[] = [];
  const isShow = entry.media.type === "ANIME" || entry.media.type === "TV";
  if (entry.status === "COMPLETED" || !isShow) posts.push({ kind: "entry", id: entry.id, entry });
  if (entry.plannedAt && entry.status !== "PLANNING") {
    posts.push({ kind: "planned", id: `${entry.id}:planned`, entry });
  }
  // Games and books keep a separate started post once they leave in progress.
  if (
    tracksStart(entry.media.type) &&
    entry.startedAt &&
    (entry.status === "COMPLETED" || entry.status === "PAUSED" || entry.status === "DROPPED")
  ) {
    posts.push({ kind: "started", id: `${entry.id}:started`, entry });
  }
  return posts;
}

/**
 * One post per book per day: that day's chapter logs together, with
 * consecutive ranges merged ("1-10", or "1-3, 8-10" after skipping ahead).
 */
function chapterPosts(logs: (ChapterLog & { media: Media })[]): Item[] {
  const groups = new Map<string, (ChapterLog & { media: Media })[]>();
  for (const l of [...logs].sort((a, b) => a.readAt.getTime() - b.readAt.getTime())) {
    const key = `${l.entryId}:${toDay(l.readAt).getTime()}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups].map(([key, group]) => {
    const ranges: [number, number][] = [];
    for (const l of [...group].sort((a, b) => a.fromChapter - b.fromChapter)) {
      const last = ranges.at(-1);
      if (last && l.fromChapter <= last[1] + 1) last[1] = Math.max(last[1], l.toChapter);
      else ranges.push([l.fromChapter, l.toChapter]);
    }
    const latest = group.at(-1)!;
    return {
      kind: "chapters" as const,
      id: `chapters:${key}`,
      reading: {
        logIds: group.map((l) => l.id),
        media: latest.media,
        ranges,
        readAt: latest.readAt,
        createdAt: latest.createdAt,
      },
    };
  });
}

/** Titles ascend; everything else descends. Empty values go last; ties go to the most recent. */
function compare(sort: SortKey, a: Item, b: Item, times: PostTimes) {
  const va = SORTS[sort].value(a, times);
  const vb = SORTS[sort].value(b, times);
  if (va === null && vb !== null) return 1;
  if (vb === null && va !== null) return -1;
  if (va !== null && vb !== null) {
    const c =
      typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb)
        : Number(vb) - Number(va);
    if (c) return c;
  }
  return postTime(b, times) - postTime(a, times);
}

/**
 * When each entry post's status was logged, from the activity log. `loggedAt`
 * is used by the "Date added" sort. `hoverTimes` is for hovering a post's date. Dates are stored as calendar days, so a time is
 * only shown when it was logged on that same day (a backdated completion has
 * no known time). Entries created with a status log "added" instead.
 */
async function getPostTimes(items: Item[]) {
  const posts = items.flatMap((i) => {
    if (i.kind === "episode" || i.kind === "chapters") return [];
    const e = i.entry;
    if (i.kind === "planned") return [{ id: i.id, entryId: e.id, status: "PLANNING", day: e.plannedAt }];
    if (i.kind === "started") return [{ id: i.id, entryId: e.id, status: "IN_PROGRESS", day: e.startedAt }];
    return [{ id: i.id, entryId: e.id, status: e.status, day: postDate(e) }];
  });
  const activity = await db.activity.findMany({
    where: {
      entryId: { in: [...new Set(posts.map((p) => p.entryId))] },
      OR: [{ action: "added" }, { action: { startsWith: "status:" } }],
    },
    select: { entryId: true, action: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const hoverTimes = new Map<string, Date>();
  const loggedAt: LoggedAt = new Map();
  for (const p of posts) {
    // Latest matching status change; otherwise the entry's creation
    // ("added" is only logged for entries created as planning or in progress).
    const createdAs = p.status === "PLANNING" || p.status === "IN_PROGRESS";
    const find = (list: typeof activity) =>
      list.find((a) => a.action === `status:${p.status}`) ??
      (createdAs ? list.find((a) => a.action === "added") : undefined);

    const forEntry = activity.filter((a) => a.entryId === p.entryId);
    const logged = find(forEntry);
    if (logged) loggedAt.set(p.id, logged.createdAt);

    if (!p.day) continue;
    const sameDay = find(
      forEntry.filter((a) => toDay(a.createdAt).getTime() === p.day!.getTime()),
    );
    if (sameDay) hoverTimes.set(p.id, sameDay.createdAt);
  }
  return { hoverTimes, loggedAt };
}

// "Episodes" is an extra tab next to the statuses.
const EPISODES_TAB = "EPISODES";

export default function ListPage({ searchParams }: PageProps<"/list">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">My list</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Entries searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Entries({ searchParams }: { searchParams: PageProps<"/list">["searchParams"] }) {
  const params = await searchParams;
  const episodesTab = params.status === EPISODES_TAB;
  const status = isStatus(params.status) ? params.status : null;
  const type = isType(params.type) ? params.type : null;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const sort: SortKey =
    typeof params.sort === "string" && params.sort in SORTS
      ? (params.sort as SortKey)
      : DEFAULT_SORT;

  const user = await getCurrentUser();
  // Type filter and title search apply to every list, count and the In Progress row.
  const titleFilter = query ? { title: { contains: query } } : {};
  const mediaFilter =
    type || query ? { media: { ...(type && { type }), ...titleFilter } } : {};
  const showsInProgress = type !== "MOVIE";

  // Everything is loaded once; the tabs and counts are worked out from it.
  const [entries, episodes, chapterLogs, inProgress] = await Promise.all([
    db.entry.findMany({ where: { userId: user.id, ...mediaFilter }, include: { media: true } }),
    db.episodeLog.findMany({ where: { userId: user.id, ...mediaFilter }, include: { media: true } }),
    db.chapterLog.findMany({ where: { userId: user.id, ...mediaFilter }, include: { media: true } }),
    showsInProgress
      ? db.entry.findMany({
          where: {
            userId: user.id,
            status: "IN_PROGRESS",
            media: { type: type ?? { in: ["ANIME", "TV", "GAME", "BOOK"] }, ...titleFilter },
          },
          include: { media: true },
          orderBy: { updatedAt: "desc" },
        })
      : [],
  ]);

  const countBy: Record<string, number> = {};
  for (const e of entries) countBy[e.status] = (countBy[e.status] ?? 0) + 1;
  const feed = entries.flatMap(feedPosts);
  const episodeItems = episodes.map((log) => ({ kind: "episode" as const, id: log.id, log }));
  // Chapter posts show under "All" only.
  const chapterItems = chapterPosts(chapterLogs);
  const total = feed.length + episodes.length + chapterItems.length;

  const unsorted: Item[] =
    episodesTab
      ? episodeItems
      : status
        ? entries
            .filter((e) => e.status === status)
            .map((entry) => ({ kind: "entry" as const, id: entry.id, entry }))
        : [...feed, ...episodeItems, ...chapterItems];
  const times = await getPostTimes(unsorted);
  const items = unsorted.sort((a, b) => compare(sort, a, b, times));

  // Number each completed post among all completions of the same title
  // (oldest first), so rewatches/replays show as #2, #3…
  const allCompleted = await db.entry.findMany({
    where: {
      userId: user.id,
      status: "COMPLETED",
      mediaId: { in: [...new Set(entries.map((e) => e.mediaId))] },
    },
    select: { id: true, mediaId: true },
    orderBy: [{ finishedAt: "asc" }, { createdAt: "asc" }],
  });

  const completionNumber = new Map<string, CompletionNumber>();
  const totals = new Map<string, number>();
  for (const c of allCompleted) {
    const n = (totals.get(c.mediaId) ?? 0) + 1;
    totals.set(c.mediaId, n);
    completionNumber.set(c.id, { n, total: 0 });
  }
  for (const c of allCompleted) completionNumber.get(c.id)!.total = totals.get(c.mediaId)!;

  // Status tabs keep the current search, type filter and sort.
  const statusHref = (s: string | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (query) p.set("q", query);
    if (type) p.set("type", type);
    if (sort !== DEFAULT_SORT) p.set("sort", sort);
    return p.size ? `/list?${p}` : "/list";
  };

  return (
    <>
      {inProgress.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            In progress
          </h2>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {inProgress.map((e) => (
              <li key={e.id}>
                <InProgressCard entryId={e.id} media={e.media} progress={e.progress} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Toolbar: search with Type/Sort beside it, then the status tabs on their own row. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ListSearch />
          <div className="flex shrink-0 flex-wrap items-center gap-4">
            <UrlSelect
              label="Type"
              param="type"
              value={type ?? "all"}
              options={[
                { value: "all", label: "All types" },
                ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
              ]}
            />
            <UrlSelect
              label="Sort"
              param="sort"
              value={sort}
              options={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))}
            />
          </div>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Tab
            href={statusHref(null)}
            active={!status && !episodesTab}
            label={`All (${total})`}
          />
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <Tab
              key={key}
              href={statusHref(key)}
              active={status === key}
              label={`${label} (${countBy[key] ?? 0})`}
            />
          ))}
          <Tab
            href={statusHref(EPISODES_TAB)}
            active={episodesTab}
            label={`Episodes (${episodes.length})`}
          />
        </nav>
      </div>

      {items.length === 0 && query ? (
        <p className="text-muted">Nothing on your list matches “{query}”.</p>
      ) : items.length === 0 ? (
        <p className="text-muted">
          Nothing here yet.{" "}
          <Link href="/search" className="text-accent underline">
            Search for something to add.
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((i) => (
            <li key={i.id}>
              {i.kind === "entry" ? (
                <EntryCard
                  entry={i.entry}
                  completion={completionNumber.get(i.id)}
                  ratingScale={user.ratingScale}
                  time={times.hoverTimes.get(i.id)}
                />
              ) : i.kind === "chapters" ? (
                <ChapterCard post={i.reading} />
              ) : i.kind !== "episode" ? (
                <EntryCard
                  entry={i.entry}
                  ratingScale={user.ratingScale}
                  post={i.kind}
                  time={times.hoverTimes.get(i.id)}
                />
              ) : (
                <EpisodeCard log={i.log} />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${active ? "bg-accent text-black" : "bg-surface text-muted hover:text-foreground"}`}
    >
      {label}
    </Link>
  );
}
