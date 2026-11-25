"use client";

import Image from "next/image";
import { useState } from "react";
import type { Entry, Media } from "@/generated/prisma/client";
import { progressTotal, STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { DetailsModal } from "./details-modal";
import { Poster } from "./poster";
import type { RatingScale } from "./rating";

type EntryWithMedia = Entry & { media: Media };

/** Status colours, matching the status lines on list posts. */
const STATUS_DOT = {
  PLANNING: "bg-violet-300",
  IN_PROGRESS: "bg-sky-400",
  COMPLETED: "bg-accent",
  PAUSED: "bg-amber-300",
  DROPPED: "bg-red-400",
} as const;

/** "★ 4.5" on five stars, "★ 8" out of ten. Ratings are stored 1-10. */
function ratingBadge(value: number, scale: RatingScale) {
  return scale === "FIVE_STARS" ? `★ ${value / 2}` : `★ ${value}`;
}

/** "In progress · 12/24", "In progress · ch. 8/30", "Completed ×2 · 2016" */
function statusLine(e: EntryWithMedia, completions: number) {
  const status =
    e.status === "COMPLETED" && completions > 1
      ? `${STATUS_LABELS.COMPLETED} ×${completions}`
      : STATUS_LABELS[e.status];
  const total = progressTotal(e.media);
  const counted = e.media.type === "ANIME" || e.media.type === "TV" || e.media.type === "BOOK";
  if (counted && e.status !== "COMPLETED" && (e.progress || total)) {
    const prefix = e.media.type === "BOOK" ? "ch. " : "";
    return `${status} · ${prefix}${e.progress}/${total ?? "?"}`;
  }
  if (e.media.type === "GAME" && e.progress && e.status !== "COMPLETED") {
    return `${status} · ${e.progress} hrs`;
  }
  return e.media.year ? `${status} · ${e.media.year}` : status;
}

/** Frosted label on top of the artwork. */
const chip =
  "rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/10 backdrop-blur-md";

/**
 * One title in the grid view: its artwork with the type and the user's rating
 * on top, and the title and status below. Clicking it opens the details.
 */
export function GridCard({
  entry: e,
  completions,
  ratingScale,
  eager = false,
}: {
  entry: EntryWithMedia;
  /** How many times the title has been completed. */
  completions: number;
  ratingScale: RatingScale;
  eager?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const total = progressTotal(e.media);
  const isVideo = e.media.type === "VIDEO";
  const perfect = e.media.type === "GAME" && e.allAchievements;
  const sizes = "(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw";

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        aria-label={`Show details for ${e.media.title}`}
        className="group flex w-full flex-col gap-2.5 text-left outline-none"
      >
        <div
          className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface shadow-md shadow-black/30 ring-1 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/50 group-focus-visible:ring-2 group-focus-visible:ring-accent ${
            perfect ? "ring-amber-300/70" : "ring-white/10 group-hover:ring-white/25"
          }`}
        >
          {isVideo ? (
            // YouTube thumbnails are wide: a blurred, zoomed copy fills the
            // tall card behind the whole thumbnail, instead of black bars.
            <>
              <Image
                src={`https://i.ytimg.com/vi/${e.media.externalId}/mqdefault.jpg`}
                alt=""
                fill
                sizes={sizes}
                loading={eager ? "eager" : "lazy"}
                className="scale-125 object-cover opacity-70 blur-xl"
              />
              <div className="absolute inset-x-0 top-1/2 aspect-video -translate-y-1/2 shadow-lg shadow-black/50">
                <Image
                  src={`https://i.ytimg.com/vi/${e.media.externalId}/mqdefault.jpg`}
                  alt={e.media.title}
                  fill
                  sizes={sizes}
                  loading={eager ? "eager" : "lazy"}
                  className="object-cover"
                />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 transition duration-500 ease-out group-hover:scale-105">
              <Poster src={e.media.posterUrl} alt={e.media.title} fill sizes={sizes} eager={eager} />
            </div>
          )}

          {/* Type on the left, the user's rating on the right */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
            <span className={chip}>{TYPE_LABELS[e.media.type]}</span>
            {e.rating && (
              <span className="rounded-md bg-accent/90 px-1.5 py-0.5 text-[11px] font-bold text-black shadow-sm backdrop-blur-md">
                {ratingBadge(e.rating, ratingScale)}
              </span>
            )}
          </div>

          {perfect && (
            <span className={`${chip} pointer-events-none absolute bottom-2 left-2 normal-case`}>
              🏆 100%
            </span>
          )}

          {/* Progress along the bottom edge for things in progress */}
          {e.status === "IN_PROGRESS" && total && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min(100, (e.progress / total) * 100)}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1 px-0.5">
          <p
            className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-accent"
            title={e.media.title}
          >
            {e.media.title}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[e.status]}`} aria-hidden />
            <span className="truncate">{statusLine(e, completions)}</span>
          </p>
        </div>
      </button>

      {showDetails && (
        <DetailsModal
          result={{
            source: e.media.source,
            externalId: e.media.externalId,
            type: e.media.type,
            title: e.media.title,
            year: e.media.year,
            posterUrl: e.media.posterUrl,
            overview: e.media.overview,
          }}
          backdropUrl={e.media.backdropUrl}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
}
