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
