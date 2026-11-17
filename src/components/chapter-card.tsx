"use client";

import { useState, useTransition } from "react";
import { removeChapterLogs } from "@/app/actions";
import type { Media } from "@/generated/prisma/client";
import { TimestampText } from "./date-text";
import { DetailsModal } from "./details-modal";
import { Poster } from "./poster";

/** One day's reading of a book: its chapter logs combined into one post. */
export type ChapterPost = {
  logIds: string[];
  media: Media;
  ranges: [number, number][]; // e.g. [[1, 10]] or [[1, 3], [8, 10]]
  readAt: Date; // the latest log's
  createdAt: Date;
};

/** "chapter 5", "chapters 1–10", "chapters 1–3, 8–10" */
function describe(ranges: ChapterPost["ranges"]) {
  const single = ranges.length === 1 && ranges[0][0] === ranges[0][1];
  const text = ranges.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
  return `${single ? "chapter" : "chapters"} ${text}`;
}

/** A post for chapters of a book read on one day, logged with the + button. */
export function ChapterCard({ post }: { post: ChapterPost }) {
  const [showDetails, setShowDetails] = useState(false);
  const [removing, startRemove] = useTransition();
  const { media } = post;
  const label = describe(post.ranges);

  const remove = () => {
    if (!confirm(`Remove reading ${label} of "${media.title}"?`)) return;
    startRemove(() => removeChapterLogs(post.logIds));
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

        <div className="flex flex-col gap-1 text-sm">
          <p className="text-muted">
            Read <span className="font-medium text-foreground">{label}</span>
            {media.chapters && ` of ${media.chapters}`}
          </p>
          <p className="font-medium text-accent">
            <TimestampText date={post.readAt} />
          </p>
        </div>
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
