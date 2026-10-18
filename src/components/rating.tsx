"use client";

import { useState } from "react";

// Ratings are stored as 1-10. In "FIVE_STARS" mode each point is half a star,
// so 7 shows as ★★★½.
export type RatingScale = "TEN" | "FIVE_STARS";

const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z";

/** One star filled 0, 0.5 or 1. */
function Star({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="absolute inset-0 fill-white/15">
        <path d={STAR_PATH} />
      </svg>
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
        <svg viewBox="0 0 24 24" width={size} height={size} className="fill-accent">
          <path d={STAR_PATH} />
        </svg>
      </span>
    </span>
  );
}

function Stars({ value, size }: { value: number; size: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        // Each star covers two rating points: star i is points 2i-1 and 2i.
        const fill = value >= i * 2 ? 1 : value === i * 2 - 1 ? 0.5 : 0;
        return <Star key={i} fill={fill} size={size} />;
      })}
    </span>
  );
}

/** Read-only rating in the user's chosen scale. */
export function RatingDisplay({ value, scale }: { value: number; scale: RatingScale }) {
  if (scale === "FIVE_STARS") {
    return (
      <span className="inline-flex" title={`${value / 2} out of 5 stars`}>
        <Stars value={value} size={16} />
      </span>
    );
  }
  return <span>★ {value}/10</span>;
}

/**
 * Letterboxd-style star picker: hover to preview, click to set (left half of a
 * star = half star). Click the current rating again to clear it. Submits as a
 * hidden input so it works inside a normal form.
 */
function StarInput({ name, defaultValue }: { name: string; defaultValue: number | null }) {
  const [value, setValue] = useState(defaultValue ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const pick = (v: number) => setValue((current) => (current === v ? 0 : v));

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value || ""} />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value / 2}
        aria-valuetext={value ? `${value / 2} stars` : "No rating"}
        onMouseLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") setValue((v) => Math.min(10, v + 1));
          else if (e.key === "ArrowLeft" || e.key === "ArrowDown") setValue((v) => Math.max(0, v - 1));
          else if (e.key === "Delete" || e.key === "Backspace") setValue(0);
          else return;
          e.preventDefault();
        }}
        className="relative inline-flex cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Stars value={shown} size={24} />
        {/* Ten invisible hit areas, one per half star. */}
        <div className="absolute inset-0 grid grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              onMouseEnter={() => setHover(i + 1)}
              onClick={() => pick(i + 1)}
            />
          ))}
        </div>
      </div>
      <span className="w-8 text-xs text-muted">{shown ? `${shown / 2}` : "–"}</span>
    </div>
  );
}

/** Rating field for edit forms, matching the user's chosen scale. */
export function RatingField({
  name,
  defaultValue,
  scale,
  className,
}: {
  name: string;
  defaultValue: number | null;
  scale: RatingScale;
  className?: string;
}) {
  if (scale === "FIVE_STARS") return <StarInput name={name} defaultValue={defaultValue} />;
  return (
    <input
      name={name}
      type="number"
      min={1}
      max={10}
      placeholder="–"
      defaultValue={defaultValue ?? ""}
      className={className}
    />
  );
}
