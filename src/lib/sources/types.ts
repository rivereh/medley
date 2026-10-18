import type { MediaSource, MediaType } from "@/generated/prisma/enums";

export type SearchResult = {
  source: MediaSource;
  externalId: string;
  type: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
};

export type MediaDetails = SearchResult & {
  backdropUrl: string | null;
  genres: string[];
  score: number | null; // 0-100
  totalUnits: number | null; // episodes for shows/anime
  facts: { label: string; value: string }[];
};
