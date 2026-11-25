"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TYPE_LABELS } from "@/lib/labels";
import type { SearchResult } from "@/lib/sources/types";
import { DetailsModal } from "./details-modal";

// Searching starts once typing pauses this long, and only from this many
// characters: typing "dune" sends one search, not four.
const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

type Section = { key: string; label: string };
type SectionState = { loading: boolean; results: SearchResult[] };

// Recent answers, so retyping or backspacing to an earlier query is instant
// and costs nothing. (The server keeps its own cache too.)
const recent = new Map<string, SearchResult[]>();

/**
 * Search box in the header: results show as you type, starting with titles
 * already on your list, then each online source as it answers. Enter opens
 * the full search page.
 */
export function HeaderSearch({ categories }: { categories: Section[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<Record<string, SectionState>>({});
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const all: Section[] = [{ key: "library", label: "On your list" }, ...categories];
  const q = query.trim();

  useEffect(() => {
    if (q.length < MIN_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const s of all) {
        const cacheKey = `${s.key}:${q.toLowerCase()}`;
        const cached = recent.get(cacheKey);
        if (cached) {
          setSections((prev) => ({ ...prev, [s.key]: { loading: false, results: cached } }));
          continue;
        }
        setSections((prev) => ({ ...prev, [s.key]: { loading: true, results: [] } }));
        const params = new URLSearchParams({ q, source: s.key });
        fetch(`/api/quick-search?${params}`, { signal: controller.signal })
          .then((res) => res.json())
          .then((data: { results?: SearchResult[] }) => {
            const results = data.results ?? [];
            recent.set(cacheKey, results);
            setSections((prev) => ({ ...prev, [s.key]: { loading: false, results } }));
          })
          .catch(() => {
            // Aborted (a newer query replaced it) or failed: drop the spinner.
            if (!controller.signal.aborted) {
              setSections((prev) => ({ ...prev, [s.key]: { loading: false, results: [] } }));
            }
          });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort(); // a newer query (or closing) cancels requests still running
    };
    // `all` is rebuilt every render from the fixed `categories`; q is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Clicking anywhere else closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = q.length >= MIN_LENGTH;
  const anyLoading = all.some((s) => sections[s.key]?.loading);
  const anyResults = all.some((s) => (sections[s.key]?.results.length ?? 0) > 0);

  const pick = (r: SearchResult) => {
    setSelected(r);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative w-full sm:w-64">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q) return;
          setOpen(false);
          router.push(`/search?${new URLSearchParams({ q })}`);
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search…"
          aria-label="Search movies, shows, anime, games, books and YouTube"
          className="w-full rounded-full bg-surface px-4 py-1.5 text-sm outline-none ring-1 ring-white/10 transition placeholder:text-muted focus:ring-2 focus:ring-accent"
        />
      </form>

      {open && shown && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-surface p-2 shadow-2xl shadow-black/60 ring-1 ring-white/10">
          {all.map((s) => {
            const state = sections[s.key];
            if (!state || (!state.loading && state.results.length === 0)) return null;
            return (
              <section key={s.key} className="py-1">
                <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {s.label}
                </h3>
                {state.loading ? (
                  <p className="px-2 py-1.5 text-xs text-muted">Searching…</p>
                ) : (
                  <ul>
                    {state.results.map((r) => (
                      <li key={`${r.source}:${r.externalId}`}>
                        <button
                          type="button"
                          onClick={() => pick(r)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5"
                        >
                          <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-background">
                            {r.posterUrl && (
                              <Image src={r.posterUrl} alt="" fill sizes="32px" className="object-cover" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{r.title}</span>
                            <span className="block truncate text-xs text-muted">
                              {TYPE_LABELS[r.type]}
                              {r.year ? ` · ${r.year}` : ""}
                              {r.overview && r.overview.length < 60 ? ` · ${r.overview}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {!anyLoading && !anyResults && (
            <p className="px-2 py-2 text-sm text-muted">No results for “{q}”.</p>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(`/search?${new URLSearchParams({ q })}`);
            }}
            className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm text-accent hover:bg-white/5"
          >
            See all results for “{q}” →
          </button>
        </div>
      )}

      {selected && (
        <DetailsModal
          result={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
