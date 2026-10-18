// Display labels shared by server and client components.

export const STATUS_LABELS = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  PAUSED: "Paused",
  DROPPED: "Dropped",
} as const;

export type Status = keyof typeof STATUS_LABELS;

export const TYPE_LABELS = { MOVIE: "Movie", TV: "TV", ANIME: "Anime", GAME: "Game" } as const;

export type Type = keyof typeof TYPE_LABELS;

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && v in STATUS_LABELS;
}

export function isType(v: unknown): v is Type {
  return typeof v === "string" && v in TYPE_LABELS;
}
