"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { logChapters, logNextEpisode } from "@/app/actions";
import type { Media } from "@/generated/prisma/client";
import { DetailsModal } from "./details-modal";
import { Poster } from "./poster";

/**
 * AniList-style "In Progress" tile: hover the poster and press + to log the
 * next episode. For books, + asks which chapters you read. Games have no
 * episodes, so their tile just shows hours played.
 */
export function InProgressCard({
  entryId,
  media,
  progress: savedProgress,
}: {
  entryId: string;
  media: Media;
  progress: number;
}) {
  const [pending, startTransition] = useTransition();
  const [showDetails, setShowDetails] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Bumped the moment + is pressed; the episode name follows once it's looked up.
  const [progress, setProgress] = useOptimistic(savedProgress);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isGame = media.type === "GAME";
  const isBook = media.type === "BOOK";
  // Books count chapters (a count the user enters), not the page count.
  const total = isGame ? null : isBook ? media.chapters : media.totalUnits;
  const done = isGame || (total !== null && progress >= total);
  // Books: the "read chapters from … to …" box, open while not null.
  const [chapters, setChapters] = useState<{ from: string; to: string; total: string } | null>(
    null,
  );

  const showToast = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const logNext = () =>
    startTransition(async () => {
      setProgress(progress + 1);
      showToast(`Ep ${progress + 1}`);
      const res = await logNextEpisode(entryId);
      if (!res) {
        setToast(null);
        return;
      }
      showToast(
        res.finished
          ? "Finished! 🎉"
          : `Ep ${res.episode}${res.title ? ` · ${res.title}` : ""}`,
      );
    });

  const openChapters = () =>
    setChapters({ from: String(progress + 1), to: String(progress + 1), total: "" });

  const saveChapters = () =>
    startTransition(async () => {
      if (!chapters) return;
      const from = Number(chapters.from);
      const to = Number(chapters.to);
      const newTotal = chapters.total ? Number(chapters.total) : null;
      setChapters(null);
      setProgress(to);
      const res = await logChapters(entryId, from, to, newTotal);
      if (!res) {
        showToast("Couldn’t log that, check the chapters");
        return;
      }
      showToast(
        res.finished
          ? "Finished! 🎉"
          : from === to
            ? `Read chapter ${to}`
            : `Read chapters ${from}–${to}`,
      );
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
            {isGame ? (progress ? `${progress} hrs` : "Playing") : isBook ? `ch. ${progress}` : progress}
            {total ? ` / ${total}` : ""}
          </span>
          {!done && (
            <button
              type="button"
              onClick={isBook ? openChapters : logNext}
              disabled={pending}
              aria-label={
                isBook
                  ? `Log chapters read in ${media.title}`
                  : `Log episode ${progress + 1} of ${media.title}`
              }
              className="pointer-events-auto flex size-7 items-center justify-center rounded-full bg-accent text-lg font-bold leading-none text-black shadow transition hover:scale-110 disabled:opacity-60"
            >
              +
            </button>
          )}
        </div>

        {chapters && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveChapters();
            }}
            onKeyDown={(e) => e.key === "Escape" && setChapters(null)}
            className="absolute inset-x-1 bottom-2 flex flex-col gap-1.5 rounded bg-black/90 p-1.5 text-xs"
          >
            {/* "from" is editable so a book started mid-way isn't logged as 1-N. */}
            <label className="flex flex-wrap items-center gap-1">
              Ch.
              <input
                type="number"
                min={1}
                max={total ?? undefined}
                required
                aria-label="From chapter"
                value={chapters.from}
                onChange={(e) => setChapters({ ...chapters, from: e.target.value })}
                className="w-9 min-w-0 rounded bg-surface px-1 py-0.5 text-foreground [color-scheme:dark]"
              />
              –
              <input
                type="number"
                min={Number(chapters.from) || 1}
                max={total ?? undefined}
                required
                autoFocus
                aria-label="To chapter"
                value={chapters.to}
                onChange={(e) => setChapters({ ...chapters, to: e.target.value })}
                className="w-9 min-w-0 rounded bg-surface px-1 py-0.5 text-foreground [color-scheme:dark]"
              />
            </label>
            {total === null && (
              <label className="flex items-center gap-1 text-muted">
                of
                <input
                  type="number"
                  min={1}
                  placeholder="?"
                  aria-label="Total chapters (optional)"
                  value={chapters.total}
                  onChange={(e) => setChapters({ ...chapters, total: e.target.value })}
                  className="w-9 min-w-0 rounded bg-surface px-1 py-0.5 text-foreground [color-scheme:dark]"
                />
                total
              </label>
            )}
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => setChapters(null)}
                className="px-1 text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button className="rounded bg-accent px-2 font-medium text-black">Save</button>
            </div>
          </form>
        )}

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
