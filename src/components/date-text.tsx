"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime, formatDay, formatTimestamp } from "@/lib/dates";

const hoverClass = "cursor-help decoration-dotted underline-offset-2 hover:underline";

const noop = () => () => {};

/**
 * False while the page is server-rendered and hydrating, true after. Times are
 * shown in the browser's time zone, which the server may not share (e.g. a
 * Docker container running in UTC), so they're drawn again once in the browser.
 */
function useInBrowser() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * A calendar day (startedAt, finishedAt, …). Hovering shows the time it was
 * logged, when we know it; backdated days have no time.
 */
export function DayText({ day, time }: { day: Date; time?: Date | null }) {
  const inBrowser = useInBrowser();
  return (
    <span
      // Remounting replaces the server's text, which hydration would keep.
      key={inBrowser ? "browser" : "server"}
      title={time ? formatDateTime(time) : `${formatDay(day)} (no time recorded)`}
      className={hoverClass}
      suppressHydrationWarning
    >
      {formatDay(day)}
    </span>
  );
}

/** A real timestamp (createdAt, watchedAt). Hovering shows the time. */
export function TimestampText({ date }: { date: Date }) {
  const inBrowser = useInBrowser();
  return (
    <span
      key={inBrowser ? "browser" : "server"}
      title={formatDateTime(date)}
      className={hoverClass}
      suppressHydrationWarning
    >
      {formatTimestamp(date)}
    </span>
  );
}
