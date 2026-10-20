"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addToList, getMediaDetails } from "@/app/actions";
import { STATUS_LABELS, TYPE_LABELS, type Status } from "@/lib/labels";
import type { SearchResult } from "@/lib/sources/types";
import { EpisodeList } from "./episode-list";
import { Poster } from "./poster";

type Loaded = Awaited<ReturnType<typeof getMediaDetails>>;

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DetailsModal({
  result,
  backdropUrl,
  onClose,
}: {
  result: SearchResult;
  /** Banner already cached for this title (e.g. on a My list post), shown right away. */
  backdropUrl?: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [bannerLoaded, setBannerLoaded] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMediaDetails({ source: result.source, type: result.type, externalId: result.externalId })
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [result.source, result.type, result.externalId]);

  // Show what the search result already has while the full details load.
  const d = data?.details;
  const backdrop = backdropUrl ?? d?.backdropUrl;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      // Clicking the dimmed backdrop (the dialog element itself) closes it.
      onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
      className="m-auto w-[min(48rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-hidden rounded-lg bg-surface p-0 text-foreground backdrop:bg-black/70"
    >
      <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="relative h-40 w-full bg-background sm:h-56">
          {backdrop && (
            <Image
              src={backdrop}
              alt=""
              fill
              sizes="48rem"
              loading="eager"
              fetchPriority="high"
              onLoad={() => setBannerLoaded(true)}
              className={`object-cover transition-opacity duration-300 ${bannerLoaded ? "opacity-60" : "opacity-0"}`}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-sm hover:bg-black/80"
          >
            ✕
          </button>
        </div>

        <div className="-mt-20 flex flex-col gap-6 px-5 pb-6 sm:flex-row">
          <div className="relative w-28 shrink-0 sm:w-40">
            <Poster src={result.posterUrl} alt={result.title} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:pt-20">
            <div>
              <h2 className="text-2xl font-bold leading-tight">{d?.title ?? result.title}</h2>
              <p className="text-sm text-muted">
                {TYPE_LABELS[result.type]}
                {result.year ? ` · ${result.year}` : ""}
                {d?.score != null && (
                  <>
                    {" · "}
                    <span className="text-accent">{d.score}%</span> score
                  </>
                )}
              </p>
            </div>

            {d && d.genres.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {d.genres.map((g) => (
                  <li key={g} className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                    {g}
                  </li>
                ))}
              </ul>
            )}

            <AddSection result={result} data={data} />

            {(d?.overview ?? result.overview) && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {d?.overview ?? result.overview}
              </p>
            )}

            {error && <p className="text-sm text-red-400">Couldn’t load more details.</p>}
            {!d && !error && <p className="text-sm text-muted">Loading details…</p>}

            {d && d.facts.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {d.facts.map((f) => (
                  <div key={f.label} className="contents">
                    <dt className="text-muted">{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {(result.type === "ANIME" || result.type === "TV") && (
          <div className="px-5 pb-6">
            <EpisodeList result={result} />
          </div>
        )}
      </div>
    </dialog>
  );
}

function AddSection({ result, data }: { result: SearchResult; data: Loaded | null }) {
  const pathname = usePathname();
  const isGame = result.type === "GAME";
  // Null until picked: defaults depend on whether it's already on the list.
  const [picked, setPicked] = useState<Status | null>(null);
  const [finishedAt, setFinishedAt] = useState(todayInput);
  const [allAchievements, setAllAchievements] = useState(false);
  // State after an add/log in this modal (the fetched data is a snapshot).
  const [local, setLocal] = useState<{ latestStatus: Status; completions: number } | null>(null);
  const [justLogged, setJustLogged] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const tracked = local ?? data?.tracked ?? null;
  // Picking the status an open post already has would change nothing.
  const latestOpen =
    tracked && ["PLANNING", "IN_PROGRESS", "PAUSED"].includes(tracked.latestStatus)
      ? tracked.latestStatus
      : null;
  const statusOptions = Object.entries(STATUS_LABELS).filter(([key]) => key !== latestOpen);
  const status: Status = picked ?? (tracked ? "COMPLETED" : "PLANNING");

  const submit = (s: Status) =>
    startTransition(async () => {
      setFailed(false);
      setJustLogged(false);
      const completed = s === "COMPLETED";
      try {
        await addToList({
          source: result.source,
          type: result.type,
          externalId: result.externalId,
          status: s,
          finishedAt: completed ? finishedAt : null,
          allAchievements: completed && allAchievements,
        });
        setLocal({
          latestStatus: s,
          completions: (tracked?.completions ?? 0) + (completed ? 1 : 0),
        });
        setJustLogged(true);
        setPicked(null);
      } catch {
        setFailed(true);
      }
    });

  const completionFields = (
    <>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Completed on
        <input
          type="date"
          value={finishedAt}
          onChange={(e) => setFinishedAt(e.target.value)}
          className="rounded bg-surface px-2 py-1 text-sm text-foreground [color-scheme:dark]"
        />
      </label>
      {isGame && (
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={allAchievements}
            onChange={(e) => setAllAchievements(e.target.checked)}
            className="size-4 accent-amber-400"
          />
          🏆 100% achievements
        </label>
      )}
    </>
  );
  const statusSelect = (
    <label className="flex flex-col gap-1 text-xs text-muted">
      Status
      <select
        value={status}
        onChange={(e) => setPicked(e.target.value as Status)}
        className="rounded bg-surface px-2 py-1.5 text-sm text-foreground"
      >
        {statusOptions.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  const error = failed && (
    <p className="w-full text-xs text-red-400">Something went wrong. Try again.</p>
  );

  if (tracked) {
    return (
      <div className="flex flex-col gap-3 rounded bg-background p-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-accent">✓ On your list</span>
          <span className="text-muted">{STATUS_LABELS[tracked.latestStatus]}</span>
          {tracked.completions > 0 && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
              Completed ×{tracked.completions}
            </span>
          )}
          {pathname !== "/list" && (
            <Link href="/list" className="ml-auto text-muted underline hover:text-foreground">
              Edit in My list
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {statusSelect}
          {status === "COMPLETED" && completionFields}
          <button
            type="button"
            onClick={() => submit(status)}
            disabled={pending}
            className="rounded bg-accent px-4 py-1.5 font-medium text-black disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : status !== "COMPLETED"
                ? "Save"
                : tracked.completions > 0
                  ? "Log another completion"
                  : "Mark completed"}
          </button>
          {justLogged && <span className="pb-1.5 text-xs text-accent">Saved ✓</span>}
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded bg-background p-3 text-sm">
      {statusSelect}
      {status === "COMPLETED" && completionFields}
      <button
        type="button"
        onClick={() => submit(status)}
        disabled={pending}
        className="rounded bg-accent px-4 py-1.5 font-medium text-black disabled:opacity-60"
      >
        {pending ? "Adding…" : "+ Add to list"}
      </button>
      {error}
    </div>
  );
}
