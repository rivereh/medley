"use client";

import { useState, useTransition } from "react";
import { updateHiddenTypes } from "@/app/actions";
import { TYPE_LABELS, type Type } from "@/lib/labels";

type View = "list" | "grid";

const TYPES = Object.keys(TYPE_LABELS) as Type[];

/** Settings: which media types My list shows, separately for list and grid. */
export function FeedTypesSetting({
  hiddenList,
  hiddenGrid,
}: {
  hiddenList: Type[];
  hiddenGrid: Type[];
}) {
  const [hidden, setHidden] = useState<Record<View, Type[]>>({
    list: hiddenList,
    grid: hiddenGrid,
  });
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = (view: View, type: Type, shown: boolean) => {
    const next = shown ? hidden[view].filter((t) => t !== type) : [...hidden[view], type];
    setHidden({ ...hidden, [view]: next });
    setSaved(false);
    startTransition(async () => {
      await updateHiddenTypes(view, next);
      setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full max-w-sm text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-2 font-medium">Type</th>
            <th className="w-20 pb-2 text-center font-medium">List</th>
            <th className="w-20 pb-2 text-center font-medium">Grid</th>
          </tr>
        </thead>
        <tbody>
          {TYPES.map((type) => (
            <tr key={type} className="border-t border-white/5">
              <td className="py-1.5">{TYPE_LABELS[type]}</td>
              {(["list", "grid"] as const).map((view) => (
                <td key={view} className="py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={!hidden[view].includes(type)}
                    onChange={(e) => toggle(view, type, e.target.checked)}
                    aria-label={`Show ${TYPE_LABELS[type]} in the ${view} view`}
                    className="size-4 accent-[var(--accent)]"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {saved && <p className="text-xs text-accent">Saved ✓</p>}
    </div>
  );
}
