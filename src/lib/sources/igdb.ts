import "server-only";
import type { MediaDetails, SearchResult } from "./types";

// IGDB is run by Twitch. Create a free app at https://dev.twitch.tv/console/apps
// and put its Client ID and Client Secret in .env.
const API = "https://api.igdb.com/v4";
const IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";

type IgdbGame = {
  id: number;
  name: string;
  cover?: { image_id: string };
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  first_release_date?: number; // unix seconds
  summary?: string;
  genres?: { name: string }[];
  platforms?: { name: string }[];
  total_rating?: number;
  involved_companies?: { company: { name: string }; developer: boolean; publisher: boolean }[];
};

export function hasIgdbCredentials() {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

// App access tokens last ~60 days; keep one in memory and refresh when it expires.
let token: { value: string; expiresAt: number } | null = null;

async function getToken() {
  if (token && token.expiresAt > Date.now()) return token.value;
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID!,
    client_secret: process.env.TWITCH_CLIENT_SECRET!,
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: "POST" });
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`);
  const data: { access_token: string; expires_in: number } = await res.json();
  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return token.value;
}

async function igdb<T>(endpoint: string, body: string): Promise<T> {
  const res = await fetch(`${API}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${await getToken()}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB request failed: ${res.status}`);
  return res.json();
}

function image(id: string | undefined, size: string) {
  return id ? `${IMAGE_BASE}/${size}/${id}.jpg` : null;
}

function toResult(g: IgdbGame): SearchResult {
  return {
    source: "IGDB",
    externalId: String(g.id),
    type: "GAME",
    title: g.name,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    posterUrl: image(g.cover?.image_id, "t_cover_big"),
    overview: g.summary ?? null,
  };
}

export async function searchIgdb(query: string): Promise<SearchResult[]> {
  const q = query.replace(/"/g, "");
  // game_type 0 = main game, 8 = remake, 9 = remaster, 10 = expanded, 11 = port
  // (skips DLC, bundles and mods)
  const games = await igdb<IgdbGame[]>(
    "games",
    `search "${q}"; fields name,cover.image_id,first_release_date,summary; where game_type = (0,8,9,10,11); limit 20;`,
  );
  return games.map(toResult);
}

export async function getIgdbDetails(id: string): Promise<MediaDetails> {
  const [g] = await igdb<IgdbGame[]>(
    "games",
    `fields name,cover.image_id,artworks.image_id,screenshots.image_id,first_release_date,summary,
       genres.name,platforms.name,total_rating,
       involved_companies.company.name,involved_companies.developer,involved_companies.publisher;
     where id = ${Number(id)};`,
  );
  if (!g) throw new Error("Game not found");

  const companies = (role: "developer" | "publisher") =>
    g.involved_companies?.filter((c) => c[role]).map((c) => c.company.name) ?? [];

  const facts: MediaDetails["facts"] = [];
  if (companies("developer").length)
    facts.push({ label: "Developer", value: companies("developer").join(", ") });
  if (companies("publisher").length)
    facts.push({ label: "Publisher", value: companies("publisher").join(", ") });
  if (g.platforms?.length)
    facts.push({ label: "Platforms", value: g.platforms.map((p) => p.name).join(", ") });
  if (g.first_release_date)
    facts.push({
      label: "Released",
      value: new Date(g.first_release_date * 1000).toISOString().slice(0, 10),
    });

  return {
    ...toResult(g),
    backdropUrl: image(g.artworks?.[0]?.image_id ?? g.screenshots?.[0]?.image_id, "t_1080p"),
    genres: g.genres?.map((x) => x.name) ?? [],
    score: g.total_rating ? Math.round(g.total_rating) : null,
    totalUnits: null,
    facts,
  };
}
