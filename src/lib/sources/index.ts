import "server-only";
import type { MediaSource, MediaType } from "@/generated/prisma/enums";
import { getAnilistDetails, searchAnilist } from "./anilist";
import { getIgdbDetails, hasIgdbCredentials, searchIgdb } from "./igdb";
import { getTmdbDetails, hasTmdbToken, searchTmdb } from "./tmdb";
import type { MediaDetails, SearchResult } from "./types";

export type { MediaDetails, SearchResult };

// One searchable category per source.
export const CATEGORIES = {
  screen: {
    label: "Movies & TV",
    search: searchTmdb,
    isConfigured: hasTmdbToken,
    setupHint: "Add a free TMDB key (TMDB_READ_TOKEN) to config.env, see README.txt,",
  },
  anime: {
    label: "Anime",
    search: searchAnilist,
    isConfigured: () => true,
    setupHint: "",
  },
  games: {
    label: "Games",
    search: searchIgdb,
    isConfigured: hasIgdbCredentials,
    setupHint:
      "Add free Twitch keys (TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET) to config.env, see README.txt,",
  },
} satisfies Record<
  string,
  {
    label: string;
    search: (q: string) => Promise<SearchResult[]>;
    isConfigured: () => boolean;
    setupHint: string;
  }
>;

export type Category = keyof typeof CATEGORIES;

export function getDetails(
  source: MediaSource,
  type: MediaType,
  externalId: string,
): Promise<MediaDetails> {
  switch (source) {
    case "TMDB":
      if (type !== "MOVIE" && type !== "TV") throw new Error(`Bad TMDB type ${type}`);
      return getTmdbDetails(type, externalId);
    case "ANILIST":
      return getAnilistDetails(externalId);
    case "IGDB":
      return getIgdbDetails(externalId);
  }
}
