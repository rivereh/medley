import "server-only";
import type { MediaDetails, SearchResult } from "./types";

const API = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

type TmdbMultiResult = {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
};

type TmdbDetails = TmdbMultiResult & {
  backdrop_path?: string | null;
  genres?: { name: string }[];
  vote_average?: number;
  runtime?: number;
  number_of_episodes?: number;
  number_of_seasons?: number;
  status?: string;
  created_by?: { name: string }[];
  networks?: { name: string }[];
  credits?: { crew: { job: string; name: string }[] };
};

export function hasTmdbToken() {
  return Boolean(process.env.TMDB_READ_TOKEN);
}

async function tmdb<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}` },
  });
  if (!res.ok) throw new Error(`TMDB request failed: ${res.status}`);
  return res.json();
}

function yearOf(date?: string) {
  return date ? Number(date.slice(0, 4)) : null;
}

export async function searchTmdb(query: string): Promise<SearchResult[]> {
  const data = await tmdb<{ results: TmdbMultiResult[] }>(
    `/search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
  );

  return data.results
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => ({
      source: "TMDB",
      externalId: String(r.id),
      type: r.media_type === "movie" ? "MOVIE" : "TV",
      title: r.title ?? r.name ?? "Untitled",
      year: yearOf(r.release_date || r.first_air_date),
      posterUrl: r.poster_path ? `${POSTER_BASE}${r.poster_path}` : null,
      overview: r.overview || null,
    }));
}

export async function getTmdbDetails(type: "MOVIE" | "TV", id: string): Promise<MediaDetails> {
  const kind = type === "MOVIE" ? "movie" : "tv";
  const d = await tmdb<TmdbDetails>(`/${kind}/${id}?append_to_response=credits`);

  const facts: MediaDetails["facts"] = [];
  if (type === "MOVIE") {
    const directors = d.credits?.crew.filter((c) => c.job === "Director").map((c) => c.name);
    if (directors?.length) facts.push({ label: "Director", value: directors.join(", ") });
    if (d.runtime) facts.push({ label: "Runtime", value: `${d.runtime} min` });
    if (d.release_date) facts.push({ label: "Released", value: d.release_date });
  } else {
    if (d.created_by?.length)
      facts.push({ label: "Created by", value: d.created_by.map((c) => c.name).join(", ") });
    if (d.number_of_seasons) facts.push({ label: "Seasons", value: String(d.number_of_seasons) });
    if (d.number_of_episodes) facts.push({ label: "Episodes", value: String(d.number_of_episodes) });
    if (d.networks?.length)
      facts.push({ label: "Network", value: d.networks.map((n) => n.name).join(", ") });
    if (d.first_air_date) facts.push({ label: "First aired", value: d.first_air_date });
  }
  if (d.status) facts.push({ label: "Status", value: d.status });

  return {
    source: "TMDB",
    externalId: id,
    type,
    title: d.title ?? d.name ?? "Untitled",
    year: yearOf(d.release_date || d.first_air_date),
    posterUrl: d.poster_path ? `${POSTER_BASE}${d.poster_path}` : null,
    backdropUrl: d.backdrop_path ? `${BACKDROP_BASE}${d.backdrop_path}` : null,
    overview: d.overview || null,
    genres: d.genres?.map((g) => g.name) ?? [],
    score: d.vote_average ? Math.round(d.vote_average * 10) : null,
    totalUnits: type === "TV" ? (d.number_of_episodes ?? null) : null,
    facts,
  };
}
