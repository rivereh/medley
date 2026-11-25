"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getEpisodeDetails } from "@/app/actions";
import { formatDateTime, formatDay } from "@/lib/dates";

type Loaded = NonNullable<Awaited<ReturnType<typeof getEpisodeDetails>>>;

/**
 * Details for one episode of a show, opened from an episode post: its name,
 * air date, description and every time the user watched it.
 */
export function EpisodeModal({
  mediaId,
  showTitle,
  episode,
  fallback,
  backdropUrl,
  onShowDetails,
  onClose,
}: {
  mediaId: string;
  showTitle: string;
  episode: number;
  /** What the post already knows, shown while the rest loads. */
  fallback: { title: string | null; season: number | null; seasonEpisode: number | null };
  /** The show's banner, used when the episode has no thumbnail. */
  backdropUrl: string | null;
  onShowDetails: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getEpisodeDetails(mediaId, episode)
      .then((d) => !cancelled && (d ? setData(d) : setFailed(true)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [mediaId, episode]);

  const info = data?.info;
  const title = info?.title ?? fallback.title;
  const season = info?.season ?? fallback.season;
  const seasonEpisode = info?.seasonEpisode ?? fallback.seasonEpisode;
  const image = info?.thumbnailUrl ?? backdropUrl;
  const watches = data?.watches ?? [];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicking the dimmed backdrop (the dialog element itself) closes it.
      onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg bg-surface p-0 text-foreground backdrop:bg-black/70"
    >
      <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="relative aspect-video w-full bg-background">
          {image && (
            // Thumbnails come from several hosts (TMDB, Kitsu, Crunchyroll).
            <Image src={image} alt="" fill unoptimized sizes="36rem" className="object-cover" />
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-sm hover:bg-black/80"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
                onShowDetails();
              }}
              className="text-sm text-muted hover:text-accent hover:underline"
            >
              {showTitle} →
            </button>
            <p className="mt-1 text-xs text-muted">
              {season && seasonEpisode
                ? `Season ${season}, episode ${seasonEpisode} · episode ${episode} overall`
                : `Episode ${episode}`}
            </p>
            <h2 className="text-xl font-bold leading-tight">{title ?? `Episode ${episode}`}</h2>
            {(info?.airDate || info?.runtime) && (
              <p className="mt-1 text-sm text-muted">
                {info.airDate && `Aired ${formatDay(info.airDate)}`}
                {info.airDate && info.runtime ? " · " : ""}
                {info.runtime ? `${info.runtime} min` : ""}
              </p>
            )}
          </div>

          {info?.overview && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
              {info.overview}
            </p>
          )}

          {failed && <p className="text-sm text-red-400">Couldn’t load this episode.</p>}
          {!data && !failed && <p className="text-sm text-muted">Loading…</p>}

          {data && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {watches.length === 0
                  ? "Not watched yet"
                  : watches.length === 1
                    ? "Watched once"
                    : `Watched ${watches.length} times`}
              </h3>
              {/* Newest first; numbered oldest = #1, like rewatches elsewhere. */}
              <ul className="flex flex-col gap-1 text-sm">
                {watches.map((w, i) => (
                  <li key={w.id} className="flex items-center gap-2">
                    {watches.length > 1 && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                        #{watches.length - i}
                      </span>
                    )}
                    <span>{formatDateTime(w.watchedAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </dialog>
  );
}
