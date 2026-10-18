"use client";

import { useState, useTransition } from "react";
import { updateRatingScale } from "@/app/actions";
import { RatingDisplay, type RatingScale } from "./rating";

const OPTIONS: { value: RatingScale; label: string; description: string }[] = [
  {
    value: "FIVE_STARS",
    label: "5 stars (default)",
    description: "Half stars allowed. Hover over the stars to pick a rating.",
  },
  { value: "TEN", label: "Out of 10", description: "Whole numbers from 1 to 10." },
];

export function RatingScaleSetting({ current }: { current: RatingScale }) {
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const choose = (scale: RatingScale) => {
    setValue(scale);
    setSaved(false);
    startTransition(async () => {
      await updateRatingScale(scale);
      setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Rating format" className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition ${
                selected ? "border-accent bg-accent/10" : "border-white/10 hover:border-white/25"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ratingScale"
                  value={o.value}
                  checked={selected}
                  onChange={() => choose(o.value)}
                  className="accent-accent"
                />
                <span className="font-medium">{o.label}</span>
              </span>
              <span className="text-sm text-muted">{o.description}</span>
              <span className="text-sm">
                Example: <RatingDisplay value={7} scale={o.value} />
              </span>
            </label>
          );
        })}
      </div>
      <p className="h-4 text-xs text-muted" aria-live="polite">
        {pending ? "Saving…" : saved ? "Saved ✓" : ""}
      </p>
    </div>
  );
}
