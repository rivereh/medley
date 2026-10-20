import Link from "next/link";
import { Suspense } from "react";
import { type CompletionNumber, EntryCard } from "@/components/entry-card";
import { EpisodeCard } from "@/components/episode-card";
import { InProgressCard } from "@/components/in-progress-card";
import { ListSearch } from "@/components/list-search";
import { UrlSelect } from "@/components/url-select";
import type { Entry, EpisodeLog, Media } from "@/generated/prisma/client";
import { postDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { isStatus, isType, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/lib/user";

// My list mixes several kinds of posts: entries (planning / completed / …),
// episode logs from the +1 button, and the earlier steps of an entry that has
// moved on: its planning post, and for games its started post. They're
// merged and sorted together here.
type EntryItem = Entry & { media: Media };
type EpisodeItem = EpisodeLog & { media: Media };
type Item =
  | { kind: "entry" | "planned" | "started"; id: string; entry: EntryItem }
  | { kind: "episode"; id: string; log: EpisodeItem };

type SortValue = Date | number | string | null;
type Pickers = {
  entry: (e: EntryItem) => SortValue;
  planned: (e: EntryItem) => SortValue;
  started: (e: EntryItem) => SortValue;
  episode: (l: EpisodeItem) => SortValue;
};

const pick = (i: Item, p: Pickers) => (i.kind === "episode" ? p.episode(i.log) : p[i.kind](i.entry));
const none = () => null;

const SORTS = {
  completed: {
    label: "Date",
    value: (i: Item) =>
      pick(i, {
        entry: postDate,
        planned: (e) => e.plannedAt,
        started: (e) => e.startedAt,
        episode: (l) => l.watchedAt,
      }),
  },
  added: {
    label: "Date added",
    value: (i: Item) =>
      pick(i, {
        entry: (e) => e.createdAt,
        planned: (e) => e.createdAt,
        started: (e) => e.createdAt,
        episode: (l) => l.createdAt,
      }),
  },
  updated: {
    label: "Recently updated",
    value: (i: Item) =>
      pick(i, {
        entry: (e) => e.updatedAt,
        planned: (e) => e.plannedAt,
        started: (e) => e.startedAt,
        episode: (l) => l.watchedAt,
      }),
  },
  started: {
    label: "Start date",
    value: (i: Item) =>
      pick(i, { entry: (e) => e.startedAt, planned: none, started: (e) => e.startedAt, episode: none }),
  },
  rating: {
    label: "Rating",
    value: (i: Item) => pick(i, { entry: (e) => e.rating, planned: none, started: none, episode: none }),
  },
  title: {
    label: "Title (A–Z)",
    value: (i: Item) =>
      pick(i, {
        entry: (e) => e.media.title,
        planned: (e) => e.media.title,
        started: (e) => e.media.title,
        episode: (l) => l.media.title,
      }),
  },
} satisfies Record<string, { label: string; value: (i: Item) => SortValue }>;

type SortKey = keyof typeof SORTS;
const DEFAULT_SORT: SortKey = "completed";

// On ties, an entry's earlier steps sort below it: planned < started < the entry.
function recency(i: Item) {
  if (i.kind === "episode") return i.log.watchedAt.getTime();
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
  // Games keep a separate started post once they leave in progress.
  if (
    entry.media.type === "GAME" &&
    entry.startedAt &&
    (entry.status === "COMPLETED" || entry.status === "PAUSED" || entry.status === "DROPPED")
  ) {
    posts.push({ kind: "started", id: `${entry.id}:started`, entry });
  }
  return posts;
}

/** Titles ascend; everything else descends. Empty values go last; ties go to the most recent. */
function compare(sort: SortKey, a: Item, b: Item) {
  const va = SORTS[sort].value(a);
  const vb = SORTS[sort].value(b);
  if (va === null && vb !== null) return 1;
  if (vb === null && va !== null) return -1;
  if (va !== null && vb !== null) {
    const c =
      typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb)
        : Number(vb) - Number(va);
    if (c) return c;
  }
  return recency(b) - recency(a);
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
  const [entries, episodes, inProgress] = await Promise.all([
    db.entry.findMany({ where: { userId: user.id, ...mediaFilter }, include: { media: true } }),
    db.episodeLog.findMany({ where: { userId: user.id, ...mediaFilter }, include: { media: true } }),
    showsInProgress
      ? db.entry.findMany({
          where: {
            userId: user.id,
            status: "IN_PROGRESS",
            media: { type: type ?? { in: ["ANIME", "TV", "GAME"] }, ...titleFilter },
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
  const total = feed.length + episodes.length;

  const items: Item[] = (
    episodesTab
      ? episodeItems
      : status
        ? entries
            .filter((e) => e.status === status)
            .map((entry) => ({ kind: "entry" as const, id: entry.id, entry }))
        : [...feed, ...episodeItems]
  ).sort((a, b) => compare(sort, a, b));

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
                />
              ) : i.kind !== "episode" ? (
                <EntryCard entry={i.entry} ratingScale={user.ratingScale} post={i.kind} />
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
