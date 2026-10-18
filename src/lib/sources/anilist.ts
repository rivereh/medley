import "server-only";
import type { MediaDetails, SearchResult } from "./types";

// AniList's public GraphQL API needs no key (rate limit ~90 requests/min).
const API = "https://graphql.anilist.co";

type AniMedia = {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null };
  bannerImage?: string | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  episodes: number | null;
  duration?: number | null;
  format: string | null;
  status?: string | null;
  description: string | null;
  genres?: string[];
  averageScore?: number | null;
  season?: string | null;
  studios?: { nodes: { name: string }[] };
};

const BASE_FIELDS = `
  id
  title { romaji english }
  coverImage { large }
  startDate { year month day }
  episodes
  format
  description(asHtml: false)
`;

async function anilist<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList request failed: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`AniList error: ${json.errors[0]?.message}`);
  return json.data;
}

// Descriptions come with <br> and <i> tags even with asHtml: false.
function cleanDescription(text: string | null) {
  if (!text) return null;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toResult(m: AniMedia): SearchResult {
  return {
    source: "ANILIST",
    externalId: String(m.id),
    type: "ANIME",
    title: m.title.english || m.title.romaji || "Untitled",
    year: m.startDate.year,
    posterUrl: m.coverImage.large,
    overview: cleanDescription(m.description),
  };
}

const FORMAT_LABELS: Record<string, string> = {
  TV: "TV series",
  TV_SHORT: "TV short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music video",
};

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

export async function searchAnilist(query: string): Promise<SearchResult[]> {
  const data = await anilist<{ Page: { media: AniMedia[] } }>(
    `query ($search: String) {
      Page(perPage: 20) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) { ${BASE_FIELDS} }
      }
    }`,
    { search: query },
  );
  return data.Page.media.map(toResult);
}

export async function getAnilistDetails(id: string): Promise<MediaDetails> {
  const { Media: m } = await anilist<{ Media: AniMedia }>(
    `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${BASE_FIELDS}
        bannerImage
        duration
        status
        season
        genres
        averageScore
        studios(isMain: true) { nodes { name } }
      }
    }`,
    { id: Number(id) },
  );

  const facts: MediaDetails["facts"] = [];
  if (m.format) facts.push({ label: "Format", value: FORMAT_LABELS[m.format] ?? m.format });
  if (m.episodes) facts.push({ label: "Episodes", value: String(m.episodes) });
  if (m.duration) facts.push({ label: "Episode length", value: `${m.duration} min` });
  if (m.studios?.nodes.length)
    facts.push({ label: "Studio", value: m.studios.nodes.map((s) => s.name).join(", ") });
  if (m.season && m.startDate.year)
    facts.push({ label: "Season", value: `${titleCase(m.season)} ${m.startDate.year}` });
  if (m.status) facts.push({ label: "Status", value: titleCase(m.status) });
  if (m.title.english && m.title.romaji && m.title.english !== m.title.romaji)
    facts.push({ label: "Romaji", value: m.title.romaji });

  return {
    ...toResult(m),
    backdropUrl: m.bannerImage ?? null,
    genres: m.genres ?? [],
    score: m.averageScore ?? null,
    totalUnits: m.episodes,
    facts,
  };
}
