"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ListView = "list" | "grid";

/** Cookie that remembers the last view, so My list reopens in it. */
export const VIEW_COOKIE = "medley-view";

const VIEWS: { value: ListView; label: string; icon: React.ReactNode }[] = [
  {
    value: "list",
    label: "List",
    icon: (
      <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
        <rect x="1" y="2" width="14" height="3" rx="1" />
        <rect x="1" y="6.5" width="14" height="3" rx="1" />
        <rect x="1" y="11" width="14" height="3" rx="1" />
      </svg>
    ),
  },
  {
    value: "grid",
    label: "Grid",
    icon: (
      <svg viewBox="0 0 16 16" className="size-4 fill-current" aria-hidden>
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
];

function rememberView(view: ListView) {
  document.cookie = `${VIEW_COOKIE}=${view}; path=/; max-age=31536000; samesite=lax`;
}

/** List / Grid switch for My list. */
export function ViewToggle({ value }: { value: ListView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const choose = (view: ListView) => {
    rememberView(view);
    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    params.delete("show"); // start from the first page in the new view
    router.push(`${pathname}?${params}`, { scroll: false });
  };

  return (
    <div role="group" aria-label="View" className="flex rounded bg-surface p-0.5 text-sm">
      {VIEWS.map((v) => (
        <button
          key={v.value}
          type="button"
          onClick={() => choose(v.value)}
          aria-pressed={value === v.value}
          title={`${v.label} view`}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1 ${
            value === v.value ? "bg-accent text-black" : "text-muted hover:text-foreground"
          }`}
        >
          {v.icon}
          <span className="hidden sm:inline">{v.label}</span>
        </button>
      ))}
    </div>
  );
}
