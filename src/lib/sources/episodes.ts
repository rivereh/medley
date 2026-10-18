import "server-only";
import type { MediaSource } from "@/generated/prisma/enums";

export type EpisodeInfo = {
  season: number | null;
  seasonEpisode: number | null;
  title: string | null;
};

const NONE: EpisodeInfo = { season: null, seasonEpisode: null, title: null };

// Episode names are a nice-to-have: never let a slow API block logging.
const TIMEOUT_MS = 4000;

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Looks up the name (and season, for TV) of an overall episode number. */
export async function getEpisodeInfo(
  source: MediaSource,
  externalId: string,
  episode: number,
): Promise<EpisodeInfo> {
  if (source === "ANILIST") return getAnimeEpisode(externalId, episode);
  if (source === "TMDB") return getTvEpisode(externalId, episode);
  return NONE;
}

// --- Anime: AniList's streaming episode list, then MyAnimeList via Jikan ---

type AniEpisodes = {
  data: {
    Media: { idMal: number | null; streamingEpisodes: { title: string | null }[] };
  } | null;
};

async function getAnimeEpisode(anilistId: string, episode: number): Promise<EpisodeInfo> {
  const res = await getJson<AniEpisodes>("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query ($id: Int) { Media(id: $id) { idMal streamingEpisodes { title } } }`,
      variables: { id: Number(anilistId) },
    }),
  });
  const media = res?.data?.Media;

  // Streaming titles look like "Episode 5 - Phantoms of the Dead".
  for (const s of media?.streamingEpisodes ?? []) {
    const m = s.title?.match(/^Episode\s+(\d+)\s*[-–:]\s*(.+)$/i);
    if (m && Number(m[1]) === episode) return { ...NONE, title: m[2].trim() };
  }

  if (media?.idMal) {
    const jikan = await getJson<{ data?: { title?: string } }>(
      `https://api.jikan.moe/v4/anime/${media.idMal}/episodes/${episode}`,
    );
    if (jikan?.data?.title) return { ...NONE, title: jikan.data.title };
  }
  return NONE;
}

// --- TV: TMDB, mapping the overall episode number onto seasons ---

async function getTvEpisode(tmdbId: string, episode: number): Promise<EpisodeInfo> {
  const headers = { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}` };
  const show = await getJson<{ seasons?: { season_number: number; episode_count: number }[] }>(
    `https://api.themoviedb.org/3/tv/${tmdbId}`,
    { headers },
  );

  // Season 0 is specials, which don't count toward progress.
  let remaining = episode;
  for (const s of (show?.seasons ?? []).filter((s) => s.season_number > 0)) {
    if (remaining <= s.episode_count) {
      const ep = await getJson<{ name?: string }>(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/${s.season_number}/episode/${remaining}`,
        { headers },
      );
      // TMDB uses "Episode 3" as a placeholder name for unnamed episodes.
      const title = ep?.name && !/^Episode \d+$/.test(ep.name) ? ep.name : null;
      return { season: s.season_number, seasonEpisode: remaining, title };
    }
    remaining -= s.episode_count;
  }
  return NONE;
}
