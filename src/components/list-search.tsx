"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Filters My list by title as you type (kept in the URL as ?q=). */
export function ListSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    // Wait for a pause in typing before reloading the list.
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (next.trim()) params.set("q", next.trim());
      else params.delete("q");
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
    }, 250);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 fill-none stroke-muted"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="m13 13 4 4" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => update(e.target.value)}
        placeholder="Search your list…"
        aria-label="Search your list"
        className="w-full rounded bg-surface py-1.5 pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => update("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-xs text-muted hover:text-foreground"
        >
          ✕
        </button>
      )}
    </div>
  );
}
