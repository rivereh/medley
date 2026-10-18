"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { removeEntry, updateEntry } from "@/app/actions";
import type { Entry, Media } from "@/generated/prisma/client";
import { formatDay, formatTimestamp, toDayInput } from "@/lib/dates";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import { DetailsModal } from "./details-modal";
import { Poster } from "./poster";
import { RatingDisplay, RatingField, type RatingScale } from "./rating";

type EntryWithMedia = Entry & { media: Media };

/** Which completion of this title a completed post is, e.g. 2 of 3. */
export type CompletionNumber = { n: number; total: number };

export function EntryCard({
  entry: e,
  completion,
  ratingScale,
}: {
  entry: EntryWithMedia;
  completion?: CompletionNumber;
  ratingScale: RatingScale;
}) {
  const [editing, setEditing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [removing, startRemove] = useTransition();
  const isGame = e.media.type === "GAME";
  const perfect = isGame && e.allAchievements;

  const remove = () => {
    if (!confirm(`Remove "${e.media.title}" from your list?`)) return;
    startRemove(() => removeEntry(e.id));
  };

  return (
    <article
      className={`relative flex gap-4 rounded-lg p-3 transition ${
        perfect
          ? "bg-linear-to-br from-amber-400/50 via-yellow-600/20 to-surface shadow-[0_0_24px_-8px] shadow-amber-400/70 ring-1 ring-amber-300/70"
          : "bg-surface"
      } ${removing ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        onClick={remove}
        disabled={removing}
        className="absolute right-2 top-2 rounded px-2 py-1 text-xs text-muted hover:bg-white/5 hover:text-red-400"
      >
        Remove
      </button>

      {/* Poster fills the card's height; min-h keeps short cards at a 2:3 poster. */}
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        aria-label={`Show details for ${e.media.title}`}
        className="w-20 shrink-0 rounded transition hover:brightness-110 hover:ring-2 hover:ring-accent"
      >
        <Poster src={e.media.posterUrl} alt={e.media.title} fill sizes="80px" />
      </button>

      <div className="flex min-h-30 min-w-0 flex-1 flex-col gap-2">
        <div className="pr-16">
          <HeadlineDate entry={e} />
          <h2 className="mt-0.5 text-lg font-semibold leading-tight">
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="text-left hover:text-accent hover:underline"
            >
              {e.media.title}
            </button>
          </h2>
          <p className="text-xs text-muted">
            {TYPE_LABELS[e.media.type]}
            {e.media.year ? ` · ${e.media.year}` : ""}
          </p>
        </div>

        {editing ? (
          <EditForm entry={e} ratingScale={ratingScale} onDone={() => setEditing(false)} />
        ) : (
          <>
            <Summary entry={e} completion={completion} ratingScale={ratingScale} />
            <div className="mt-auto flex items-center justify-end gap-3 pt-1 text-xs text-muted">
              <span suppressHydrationWarning>Added {formatTimestamp(e.createdAt)}</span>
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
            source: e.media.source,
            externalId: e.media.externalId,
            type: e.media.type,
            title: e.media.title,
            year: e.media.year,
            posterUrl: e.media.posterUrl,
            overview: e.media.overview,
          }}
          onClose={() => setShowDetails(false)}
        />
      )}
    </article>
  );
}

/** Status line above the title, for anything not currently completed. */
function HeadlineDate({ entry: e }: { entry: EntryWithMedia }) {
  if (e.status === "COMPLETED") return null;
  return (
    <p className="text-sm font-medium text-muted">
      {STATUS_LABELS[e.status]}
      {e.startedAt && ` · Started ${formatDay(e.startedAt)}`}
    </p>
  );
}

const chipClass = "rounded-full bg-background/60 px-2 py-0.5 text-foreground/80";

function Summary({
  entry: e,
  completion,
  ratingScale,
}: {
  entry: EntryWithMedia;
  completion?: CompletionNumber;
  ratingScale: RatingScale;
}) {
  let progress: string | null = null;
  if (e.media.type === "GAME") {
    if (e.progress) progress = `${e.progress} hrs`;
  } else if (e.media.type !== "MOVIE" && (e.progress || e.media.totalUnits)) {
    progress = `${e.progress}${e.media.totalUnits ? ` / ${e.media.totalUnits}` : ""} eps`;
  }

  const perfect = e.media.type === "GAME" && e.allAchievements;

  return (
    <div className="flex flex-col gap-1 text-sm">
      {e.rating && (
        <p className="flex items-center">
          <RatingDisplay value={e.rating} scale={ratingScale} />
        </p>
      )}
      {e.finishedAt && (
        <p className="font-medium text-accent">
          Completed {formatDay(e.finishedAt)}
          {completion && completion.total > 1 && (
            <span
              title={`Completion ${completion.n} of ${completion.total}`}
              className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs"
            >
              #{completion.n}
            </span>
          )}
        </p>
      )}
      {(progress || perfect) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {progress && <span className={chipClass}>{progress}</span>}
          {perfect && (
            <span className="rounded-full bg-amber-300/90 px-2 py-0.5 font-semibold text-black">
              🏆 100% achievements
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "rounded bg-background px-2 py-1 text-sm text-foreground [color-scheme:dark]";

function EditForm({
  entry: e,
  ratingScale,
  onDone,
}: {
  entry: EntryWithMedia;
  ratingScale: RatingScale;
  onDone: () => void;
}) {
  return (
    <form
      action={async (form) => {
        await updateEntry(form);
        onDone();
      }}
      className="flex flex-col gap-3 text-sm"
    >
      <input type="hidden" name="id" value={e.id} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Status">
          <select name="status" defaultValue={e.status} className={inputClass}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {e.media.type !== "MOVIE" && (
          <Field
            label={
              e.media.type === "GAME"
                ? "Hours"
                : `Episodes${e.media.totalUnits ? ` / ${e.media.totalUnits}` : ""}`
            }
          >
            <input
              name="progress"
              type="number"
              min={0}
              max={e.media.totalUnits ?? undefined}
              defaultValue={e.progress}
              className={`${inputClass} w-20`}
            />
          </Field>
        )}
        <Field label="Rating">
          <RatingField
            name="rating"
            defaultValue={e.rating}
            scale={ratingScale}
            className={`${inputClass} w-16`}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Started">
          <input
            name="startedAt"
            type="date"
            defaultValue={toDayInput(e.startedAt)}
            className={inputClass}
          />
        </Field>
        <Field label="Completed">
          <input
            name="finishedAt"
            type="date"
            defaultValue={toDayInput(e.finishedAt)}
            className={inputClass}
          />
        </Field>
        {e.media.type === "GAME" && (
          <label className="flex items-center gap-2 pb-1 text-sm">
            <input
              name="allAchievements"
              type="checkbox"
              defaultChecked={e.allAchievements}
              className="size-4 accent-amber-400"
            />
            🏆 100% achievements
          </label>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded px-3 py-1 text-muted hover:text-foreground"
        >
          Cancel
        </button>
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded bg-accent px-4 py-1 font-medium text-black disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}
