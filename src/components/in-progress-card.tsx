"use client";

import { useState, useTransition } from "react";
import { logNextEpisode } from "@/app/actions";
import type { Media } from "@/generated/prisma/client";
import { DetailsModal } from "./details-modal";
import { Poster } from "./poster";

/** AniList-style "In Progress" tile: hover the poster and press + to log the next episode. */
export function InProgressCard({
  entryId,
  media,
  progress,
}: {
  entryId: string;
  media: Media;
  progress: number;
}) {
  const [pending, startTransition] = useTransition();
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const total = media.totalUnits;
  const done = total !== null && progress >= total;

  const logNext = () =>
    startTransition(async () => {
      const res = await logNextEpisode(entryId);
      if (!res) return;
      setToast(
        res.finished
          ? "Finished! 🎉"
          : `Ep ${res.episode}${res.title ? ` · ${res.title}` : ""}`,
      );
      setTimeout(() => setToast(null), 3000);
    });

  return (
    <div className="group flex flex-col gap-1.5">
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          aria-label={`Show details for ${media.title}`}
          className="block w-full rounded transition group-hover:brightness-110"
        >
          <Poster src={media.posterUrl} alt={media.title} sizes="120px" />
        </button>

        {/* Progress bar along the bottom edge */}
        {total && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b bg-black/50">
            <div className="h-full bg-accent" style={{ width: `${(progress / total) * 100}%` }} />
          </div>
        )}

        {/* Hover panel: always visible on touch screens, on hover with a mouse */}
        <div className="pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-between gap-1 bg-linear-to-t from-black/90 to-transparent px-1.5 pb-1 pt-6 opacity-100 transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
          <span className="text-xs font-medium">
            {progress}
            {total ? ` / ${total}` : ""}
          </span>
          {!done && (
            <button
              type="button"
              onClick={logNext}
              disabled={pending}
              aria-label={`Log episode ${progress + 1} of ${media.title}`}
              className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-accent text-lg font-bold leading-none text-black shadow transition hover:scale-110 disabled:opacity-60"
            >
              {pending ? "…" : "+"}
            </button>
          )}
        </div>

        {toast && (
          <div
            role="status"
            className="absolute inset-x-1 top-1 rounded bg-black/85 px-1.5 py-1 text-[11px] leading-tight text-accent"
          >
            {toast}
          </div>
        )}
      </div>
      <p className="truncate text-xs font-medium" title={media.title}>
        {media.title}
      </p>

      {showDetails && (
        <DetailsModal
          result={{
            source: media.source,
            externalId: media.externalId,
            type: media.type,
            title: media.title,
            year: media.year,
            posterUrl: media.posterUrl,
            overview: media.overview,
          }}
          backdropUrl={media.backdropUrl}
          onClose={() => setShowDetails(false)}
        />
      )}
    </div>
  );
}
