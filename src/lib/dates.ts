// Started/completed dates are calendar days, stored as UTC midnight
// so they never shift a day between time zones.

/** "2026-10-17" -> Date at UTC midnight, or null for empty/invalid input. */
export function parseDay(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date -> "2026-10-17" for <input type="date">. */
export function toDayInput(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** Today's local calendar day as UTC midnight. */
export function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const DISPLAY = { month: "short", day: "numeric", year: "numeric" } as const;

/** For calendar-day fields (startedAt, finishedAt). */
export function formatDay(d: Date) {
  return d.toLocaleDateString("en-US", { ...DISPLAY, timeZone: "UTC" });
}

/** For real timestamps (createdAt), shown in local time. */
export function formatTimestamp(d: Date) {
  return d.toLocaleDateString("en-US", DISPLAY);
}

/** Date -> "2026-10-17" in local time, for <input type="date"> on real timestamps. */
export function toLocalDayInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A real timestamp's local calendar day, as UTC midnight (like today()). */
export function toDay(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Whole days between two calendar-day dates. */
export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** How long something took: "finished the same day", "took 1 day", "took 12 days". */
export function formatDuration(days: number) {
  if (days <= 0) return "finished the same day";
  return days === 1 ? "took 1 day" : `took ${days} days`;
}

/**
 * The day a post is dated by: completion for completed posts, start for
 * in-progress ones, planning date for planning ones, otherwise when the
 * status was set.
 */
export function postDate(e: {
  status: string;
  plannedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  statusAt: Date | null;
  createdAt: Date;
}) {
  if (e.status === "COMPLETED" && e.finishedAt) return e.finishedAt;
  if (e.status === "IN_PROGRESS" && e.startedAt) return e.startedAt;
  if (e.status === "PLANNING" && e.plannedAt) return e.plannedAt;
  return e.statusAt ?? toDay(e.createdAt);
}
