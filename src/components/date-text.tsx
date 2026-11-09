import { formatDateTime, formatDay, formatTimestamp } from "@/lib/dates";

const hoverClass = "cursor-help decoration-dotted underline-offset-2 hover:underline";

/**
 * A calendar day (startedAt, finishedAt, …). Hovering shows the time it was
 * logged, when we know it; backdated days have no time.
 */
export function DayText({ day, time }: { day: Date; time?: Date | null }) {
  return (
    <span
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
  return (
    <span title={formatDateTime(date)} className={hoverClass} suppressHydrationWarning>
      {formatTimestamp(date)}
    </span>
  );
}
