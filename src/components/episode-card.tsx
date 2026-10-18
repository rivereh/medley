"use client";

import { useState, useTransition } from "react";
import { removeEpisodeLog, updateEpisodeWatchedAt } from "@/app/actions";
import type { EpisodeLog, Media } from "@/generated/prisma/client";
import { formatTimestamp, toLocalDayInput } from "@/lib/dates";
import { DetailsModal } from "./details-modal";
import { Poster } from "./poster";

type EpisodeWithMedia = EpisodeLog & { media: Media };

/** A post for one watched episode, logged with the +1 button. */
export function EpisodeCard({ log }: { log: EpisodeWithMedia }) {
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removing, startRemove] = useTransition();
  const { media } = log;

  // Reads as "Watched S2 E3 · ep 10 of 62" (TV) or "Watched episode 5 of 12".
  const label =
    log.season && log.seasonEpisode
      ? `S${log.season} E${log.seasonEpisode} · ep ${log.episode}`
      : `episode ${log.episode}`;

  const remove = () => {
    if (!confirm(`Remove ${label} of "${media.title}"?`)) return;
    startRemove(() => removeEpisodeLog(log.id));
  };

  return (
    <article
      className={`relative flex gap-4 rounded-lg bg-surface p-3 ${removing ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        onClick={remove}
        disabled={removing}
        className="absolute right-2 top-2 rounded px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-red-400"
      >
        Remove
      </button>

      {/* Same layout as entry posts: poster fills the card's height. */}
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        aria-label={`Show details for ${media.title}`}
        className="w-20 shrink-0 rounded transition hover:brightness-110 hover:ring-2 hover:ring-accent"
      >
        <Poster src={media.posterUrl} alt={media.title} fill sizes="80px" />
      </button>

      <div className="flex min-h-30 min-w-0 flex-1 flex-col gap-2">
        <div className="pr-16">
          <h2 className="text-lg font-semibold leading-tight">
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="text-left hover:text-accent hover:underline"
            >
              {media.title}
            </button>
          </h2>
        </div>

        {editing ? (
          <WatchedAtForm log={log} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-muted">
                Watched <span className="font-medium text-foreground">{label}</span>
                {media.totalUnits && ` of ${media.totalUnits}`}
              </p>
              {log.title && <p className="font-medium leading-tight">“{log.title}”</p>}
              <p className="font-medium text-accent" suppressHydrationWarning>
                {formatTimestamp(log.watchedAt)}
              </p>
            </div>
            <div className="mt-auto flex items-center justify-end gap-3 pt-1 text-xs text-muted">
              <span suppressHydrationWarning>Added {formatTimestamp(log.createdAt)}</span>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded bg-background/60 px-3 py-1 font-medium text-foreground hover:bg-background"
              >
                Edit
              </button>
            </div>
          </>
        )}
      </div>

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
    </article>
  );
}

function WatchedAtForm({ log, onDone }: { log: EpisodeWithMedia; onDone: () => void }) {
  const [value, setValue] = useState(() => toLocalDayInput(log.watchedAt));
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      // Only the day changes; keep the original time of day so ordering
      // among episodes watched the same day stays the same.
      const [y, m, day] = value.split("-").map(Number);
      const watchedAt = new Date(log.watchedAt);
      watchedAt.setFullYear(y, m - 1, day);
      await updateEpisodeWatchedAt(log.id, watchedAt.toISOString());
      onDone();
    });

  return (
    <div className="mt-auto flex flex-wrap items-end justify-end gap-2 pt-1 text-sm">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Watched on
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded bg-background px-2 py-1 text-sm text-foreground [color-scheme:dark]"
        />
      </label>
      <button
        type="button"
        onClick={onDone}
        className="rounded px-3 py-1 text-muted hover:text-foreground"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={save}
        disabled={pending || !value}
        className="rounded bg-accent px-4 py-1 font-medium text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
