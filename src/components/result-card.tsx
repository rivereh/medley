"use client";

import { useState } from "react";
import { STATUS_LABELS, TYPE_LABELS, type Status } from "@/lib/labels";
import type { SearchResult } from "@/lib/sources/types";
import { DetailsModal } from "./details-modal";
import { Poster } from "./poster";

export function ResultCard({ result, status }: { result: SearchResult; status: Status | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full flex-col gap-2 text-left"
      >
        <div className="relative w-full transition group-hover:brightness-110 group-hover:ring-2 group-hover:ring-accent rounded">
          <Poster src={result.posterUrl} alt={result.title} />
          {status && (
            <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {STATUS_LABELS[status]}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium leading-tight">{result.title}</p>
          <p className="text-xs text-muted">
            {TYPE_LABELS[result.type]}
            {result.year ? ` · ${result.year}` : ""}
          </p>
        </div>
      </button>
      {open && <DetailsModal result={result} onClose={() => setOpen(false)} />}
    </>
  );
}
