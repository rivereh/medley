"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { getMediaEpisodes, logEpisode } from "@/app/actions";
import { formatDay, formatTimestamp } from "@/lib/dates";
import type { SearchResult } from "@/lib/sources/types";

// `loadedAt` decides which episodes haven't aired yet.
type Loaded = NonNullable<Awaited<ReturnType<typeof getMediaEpisodes>>> & { loadedAt: number };

// Long shows start collapsed so the modal opens short.
const COLLAPSED = 12;

/**
 * The details modal's episode list for a show or anime, with thumbnails. Each
 * episode shows when it was last watched and can be logged on its own.
 */
export function EpisodeList({
  result,
  onLogged,
}: {
  result: SearchResult;
  /** Called after an episode is logged (it may have changed the list status). */
  onLogged?: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Bumped after logging an episode, to reload the watched dates.
  const [reloads, setReloads] = useState(0);
  const [logging, setLogging] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const log = (episode: number) => {
    setLogging(episode);
    startTransition(async () => {
      try {
        await logEpisode(
          { source: result.source, type: result.type, externalId: result.externalId },
          episode,
        );
        setReloads((n) => n + 1);
        onLogged?.();
      } finally {
        setLogging(null);
      }
    });
  };

  useEffect(() => {
    let cancelled = false;
    getMediaEpisodes({ source: result.source, type: result.type, externalId: result.externalId })
      .then((d) => !cancelled && d && setData({ ...d, loadedAt: Date.now() }))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [result.source, result.type, result.externalId, reloads]);

  if (failed) return <p className="text-sm text-red-400">Couldn’t load episodes.</p>;
  if (!data) return <p className="text-sm text-muted">Loading episodes…</p>;
  if (data.episodes.length === 0) return null;

  const { episodes, progress, lastWatched, loadedAt } = data;
  const shown = expanded ? episodes : episodes.slice(0, COLLAPSED);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Episodes ({episodes.length})
      </h3>
      <ol className="flex flex-col gap-2">
        {shown.map((ep) => {
          const watchedAt = lastWatched[ep.number] ?? null;
          // Counted as watched by progress alone (e.g. completed in one go): no date.
          const watched = watchedAt !== null || ep.number <= progress;
          const upcoming = ep.airDate !== null && ep.airDate.getTime() > loadedAt;
          return (
            <li
              key={ep.number}
              className={`flex gap-3 rounded bg-background p-2 ${upcoming ? "opacity-60" : ""}`}
            >
              <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded bg-surface sm:w-36">
                {ep.thumbnailUrl ? (
                  // Thumbnails come from several hosts (TMDB, Kitsu, Crunchyroll),
                  // so they're shown as-is rather than through the image optimizer.
                  <Image
                    src={ep.thumbnailUrl}
                    alt=""
                    fill
                    unoptimized
                    loading="lazy"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    {ep.number}
                  </div>
                )}
                {watched && (
                  <span className="absolute left-1 top-1 rounded bg-accent px-1.5 text-[11px] font-semibold text-black">
                    ✓
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <p className="text-xs text-muted">
                  {ep.season && ep.seasonEpisode
                    ? `S${ep.season} E${ep.seasonEpisode} · ep ${ep.number}`
                    : `Episode ${ep.number}`}
                </p>
                <p className="font-medium leading-tight">{ep.title ?? `Episode ${ep.number}`}</p>
                <p className="text-xs text-muted">
                  {ep.airDate && `${upcoming ? "Airs" : "Aired"} ${formatDay(ep.airDate)}`}
                  {ep.airDate && ep.runtime ? " · " : ""}
                  {ep.runtime ? `${ep.runtime} min` : ""}
                </p>
                {watched && (
                  <p className="text-xs font-medium text-accent">
                    {watchedAt ? `Watched ${formatTimestamp(watchedAt)}` : "Watched"}
                  </p>
                )}
              </div>
              {!upcoming && (
                <button
                  type="button"
                  onClick={() => log(ep.number)}
                  disabled={logging !== null}
                  title={`Log episode ${ep.number} as watched now`}
                  className="self-center rounded bg-surface px-3 py-1 text-xs font-medium text-foreground hover:bg-white/10 disabled:opacity-50"
                >
                  {logging === ep.number ? "Logging…" : watched ? "Log again" : "Log"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {episodes.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="self-start rounded bg-background px-3 py-1 text-sm text-muted hover:text-foreground"
        >
          {expanded ? "Show fewer" : `Show all ${episodes.length} episodes`}
        </button>
      )}
    </section>
  );
}
