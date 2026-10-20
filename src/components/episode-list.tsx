"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getMediaEpisodes } from "@/app/actions";
import { formatDay } from "@/lib/dates";
import type { SearchResult } from "@/lib/sources/types";

// `loadedAt` decides which episodes haven't aired yet.
type Loaded = NonNullable<Awaited<ReturnType<typeof getMediaEpisodes>>> & { loadedAt: number };

// Long shows start collapsed so the modal opens short.
const COLLAPSED = 12;

/** The details modal's episode list for a show or anime, with thumbnails. */
export function EpisodeList({ result }: { result: SearchResult }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMediaEpisodes({ source: result.source, type: result.type, externalId: result.externalId })
      .then((d) => !cancelled && d && setData({ ...d, loadedAt: Date.now() }))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [result.source, result.type, result.externalId]);

  if (failed) return <p className="text-sm text-red-400">Couldn’t load episodes.</p>;
  if (!data) return <p className="text-sm text-muted">Loading episodes…</p>;
  if (data.episodes.length === 0) return null;

  const { episodes, progress, loadedAt } = data;
  const shown = expanded ? episodes : episodes.slice(0, COLLAPSED);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Episodes ({episodes.length})
      </h3>
      <ol className="flex flex-col gap-2">
        {shown.map((ep) => {
          const watched = ep.number <= progress;
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
                    ✓ Watched
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
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
              </div>
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
