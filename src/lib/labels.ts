// Display labels shared by server and client components.

export const STATUS_LABELS = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  PAUSED: "Paused",
  DROPPED: "Dropped",
} as const;

export type Status = keyof typeof STATUS_LABELS;

export const TYPE_LABELS = { MOVIE: "Movie", TV: "TV", ANIME: "Anime", GAME: "Game", BOOK: "Book", VIDEO: "YouTube" } as const;

export type Type = keyof typeof TYPE_LABELS;

/** Movies and videos are just watched or not; everything else counts progress. */
export function hasProgress(type: Type) {
  return type !== "MOVIE" && type !== "VIDEO";
}

/**
 * Games and books have no episode posts, so starting one is its own post and
 * completing it says how long it took.
 */
export function tracksStart(type: Type) {
  return type === "GAME" || type === "BOOK";
}

/**
 * How many units progress counts up to: episodes for shows, chapters for books
 * (entered by the user; totalUnits is a book's page count). Null if unknown.
 */
export function progressTotal(m: { type: Type; totalUnits: number | null; chapters: number | null }) {
  return m.type === "BOOK" ? m.chapters : m.totalUnits;
}

/** A stored list of types ("ANIME,VIDEO") back into types, ignoring unknown ones. */
export function parseTypes(value: string | null | undefined): Type[] {
  return (value ?? "").split(",").filter(isType);
}

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && v in STATUS_LABELS;
}

export function isType(v: unknown): v is Type {
  return typeof v === "string" && v in TYPE_LABELS;
}
