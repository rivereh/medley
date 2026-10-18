import Link from "next/link";
import { Suspense } from "react";
import { type CompletionNumber, EntryCard } from "@/components/entry-card";
import { EpisodeCard } from "@/components/episode-card";
import { InProgressCard } from "@/components/in-progress-card";
import { UrlSelect } from "@/components/url-select";
import type { Entry, EpisodeLog, Media } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isStatus, isType, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { getCurrentUser } from "@/lib/user";

// My list mixes two kinds of posts: entries (planning / completed / …) and
// episode logs from the +1 button. They're merged and sorted together here.
type EntryItem = Entry & { media: Media };
type EpisodeItem = EpisodeLog & { media: Media };
type Item =
  | { kind: "entry"; id: string; entry: EntryItem }
  | { kind: "episode"; id: string; log: EpisodeItem };

type SortValue = Date | number | string | null;

function pick(
  i: Item,
  entry: (e: EntryItem) => SortValue,
  episode: (l: EpisodeItem) => SortValue,
) {
  return i.kind === "entry" ? entry(i.entry) : episode(i.log);
}

const SORTS = {
  completed: {
    label: "Completion date",
    value: (i: Item) => pick(i, (e) => e.finishedAt, (l) => l.watchedAt),
  },
  added: {
    label: "Date added",
    value: (i: Item) => pick(i, (e) => e.createdAt, (l) => l.createdAt),
  },
  updated: {
    label: "Recently updated",
    value: (i: Item) => pick(i, (e) => e.updatedAt, (l) => l.watchedAt),
  },
  started: {
    label: "Start date",
    value: (i: Item) => pick(i, (e) => e.startedAt, () => null),
  },
  rating: {
    label: "Rating",
    value: (i: Item) => pick(i, (e) => e.rating, () => null),
  },
  title: {
    label: "Title (A–Z)",
    value: (i: Item) => pick(i, (e) => e.media.title, (l) => l.media.title),
  },
} satisfies Record<string, { label: string; value: (i: Item) => SortValue }>;

type SortKey = keyof typeof SORTS;
const DEFAULT_SORT: SortKey = "completed";

const recency = (i: Item) => (i.kind === "entry" ? i.entry.updatedAt : i.log.watchedAt);

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
  return recency(b).getTime() - recency(a).getTime();
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
  const sort: SortKey =
    typeof params.sort === "string" && params.sort in SORTS
      ? (params.sort as SortKey)
      : DEFAULT_SORT;

  const user = await getCurrentUser();
  const typeFilter = type ? { media: { type } } : {};
  const showsInProgress = !type || type === "ANIME" || type === "TV";
  // Unfinished shows/anime are tracked by the In Progress row and their
  // episode posts, so "All" only shows their post once they're completed.
  // Their status tabs still list them for editing.
  const allFeedFilter = {
    NOT: {
      status: { not: "COMPLETED" as const },
      media: { type: { in: ["ANIME" as const, "TV" as const] } },
    },
  };

  const [entries, episodes, counts, episodeCount, allFeedCount, inProgress] = await Promise.all([
    episodesTab
      ? []
      : db.entry.findMany({
          where: { userId: user.id, ...typeFilter, ...(status ? { status } : allFeedFilter) },
          include: { media: true },
        }),
    // Episode posts show under "All" and "Episodes", not under a status tab.
    status
      ? []
      : db.episodeLog.findMany({
          where: { userId: user.id, ...typeFilter },
          include: { media: true },
        }),
    db.entry.groupBy({
      by: ["status"],
      where: { userId: user.id, ...typeFilter },
      _count: true,
    }),
    db.episodeLog.count({ where: { userId: user.id, ...typeFilter } }),
    db.entry.count({ where: { userId: user.id, ...typeFilter, ...allFeedFilter } }),
    showsInProgress
      ? db.entry.findMany({
          where: {
            userId: user.id,
            status: "IN_PROGRESS",
            media: { type: type ?? { in: ["ANIME", "TV"] } },
          },
          include: { media: true },
          orderBy: { updatedAt: "desc" },
        })
      : [],
  ]);
  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const total = allFeedCount + episodeCount;

  const items: Item[] = [
    ...entries.map((entry) => ({ kind: "entry" as const, id: entry.id, entry })),
    ...episodes.map((log) => ({ kind: "episode" as const, id: log.id, log })),
  ].sort((a, b) => compare(sort, a, b));

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

  // Status tabs keep the current type filter and sort.
  const statusHref = (s: string | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            label={`Episodes (${episodeCount})`}
          />
        </nav>
        <div className="flex flex-wrap gap-4">
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

      {items.length === 0 ? (
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
