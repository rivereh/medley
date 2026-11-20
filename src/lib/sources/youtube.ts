import "server-only";
import type { MediaDetails, SearchResult } from "./types";

// YouTube videos, added by pasting a link: no API key. The title, channel and
// thumbnail come from YouTube's public oEmbed endpoint. The upload date,
// length and description are read from the public video page when it has
// them (best-effort: if YouTube changes the page, those are just left out).

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; Medley)", "Accept-Language": "en" };
const TIMEOUT_MS = 8000;

type OEmbed = { title: string; author_name?: string; thumbnail_url?: string };

/** The 11-character video id from a YouTube link (or a bare id), else null. */
export function parseVideoId(input: string) {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id =
      url.searchParams.get("v") ??
      url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1] ??
      null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const thumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

async function oembed(id: string): Promise<OEmbed> {
  const res = await fetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(id))}`,
    { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  // 401/403: private or embedding disabled; 404: no such video.
  if (!res.ok) throw new Error(`YouTube oEmbed failed for ${id}: ${res.status}`);
  return res.json();
}

/** Extra details from the video page, when it can be read. */
async function pageDetails(id: string) {
  try {
    const res = await fetch(watchUrl(id), { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const html = await res.text();
    const uploaded = html.match(/"uploadDate":"(\d{4})-\d{2}-\d{2}/);
    const length = html.match(/"lengthSeconds":"(\d+)"/);
    const description = html.match(/"shortDescription":("(?:[^"\\]|\\.)*")/);
    return {
      year: uploaded ? Number(uploaded[1]) : null,
      date: html.match(/"uploadDate":"(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
      seconds: length ? Number(length[1]) : null,
      description: description ? (JSON.parse(description[1]) as string).trim() || null : null,
    };
  } catch {
    return null;
  }
}

/** "3:34" or "1:02:05" */
function formatLength(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * "Search" only recognises pasted links (searching YouTube needs an API key).
 * Anything else returns no results.
 */
export async function searchYoutube(query: string): Promise<SearchResult[]> {
  const id = parseVideoId(query);
  if (!id) return [];
  try {
    const o = await oembed(id);
    return [
      {
        source: "YOUTUBE",
        externalId: id,
        type: "VIDEO",
        title: o.title,
        year: null,
        posterUrl: thumbnail(id),
        overview: o.author_name ?? null,
      },
    ];
  } catch {
    return [];
  }
}

export async function getYoutubeDetails(id: string): Promise<MediaDetails> {
  const [o, page] = await Promise.all([oembed(id), pageDetails(id)]);
  const facts: MediaDetails["facts"] = [];
  if (o.author_name) facts.push({ label: "Channel", value: o.author_name });
  if (page?.seconds) facts.push({ label: "Length", value: formatLength(page.seconds) });
  if (page?.date) facts.push({ label: "Uploaded", value: page.date });
  return {
    source: "YOUTUBE",
    externalId: id,
    type: "VIDEO",
    title: o.title,
    creator: o.author_name ?? null,
    year: page?.year ?? null,
    posterUrl: thumbnail(id),
    overview: page?.description ?? null,
    backdropUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    genres: [],
    score: null,
    totalUnits: null,
    facts,
  };
}
