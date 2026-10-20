import "server-only";
import type { Media, MediaEpisode } from "@/generated/prisma/client";
import { parseDay } from "@/lib/dates";
import { db } from "@/lib/db";

// Each show's full episode list (names, thumbnails, air dates) is fetched once
// and saved as MediaEpisode rows, so the details modal can list episodes and
// the +1 button can name them without waiting on an API.
//
// Anime: Kitsu's episode list, with names and thumbnails from AniList's
// streaming list where it has them. Jikan (MyAnimeList) is a last resort for a
// single episode's name, since it's often slow or down.
// TV: TMDB, season by season.

export type EpisodeInfo = {
  season: number | null;
  seasonEpisode: number | null;
  title: string | null;
};

type EpisodeRow = Omit<MediaEpisode, "mediaId">;

const NONE: EpisodeInfo = { season: null, seasonEpisode: null, title: null };

// Lists are refreshed weekly (new episodes, names added later), or sooner when
// an episode is logged that the list doesn't have yet.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MISSING_RETRY_MS = 60 * 60 * 1000;

// Never let a slow API block logging for long.
const TIMEOUT_MS = 2500;

async function getJson<T>(url: string, init?: RequestInit, timeout = TIMEOUT_MS): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const hasEpisodes = (m: Pick<Media, "type">) => m.type === "ANIME" || m.type === "TV";

// --- Saved list -------------------------------------------------------------

// One fetch per show at a time, e.g. when adding a show and opening its modal at once.
const inFlight = new Map<string, Promise<void>>();

async function refresh(media: Media) {
  const running = inFlight.get(media.id);
  if (running) return running;
  const run = (async () => {
    const rows =
      media.source === "ANILIST"
        ? await fetchAnimeList(media.externalId)
        : media.source === "TMDB"
          ? await fetchTvList(media.externalId)
          : [];
    // A failed fetch keeps whatever was saved before.
    if (rows === null) return;
    await db.$transaction([
      db.mediaEpisode.deleteMany({ where: { mediaId: media.id } }),
      db.mediaEpisode.createMany({ data: rows.map((r) => ({ ...r, mediaId: media.id })) }),
      db.media.update({ where: { id: media.id }, data: { episodesFetchedAt: new Date() } }),
    ]);
  })().finally(() => inFlight.delete(media.id));
  inFlight.set(media.id, run);
  return run;
}

const isStale = (m: Media, maxAge: number) =>
  !m.episodesFetchedAt || Date.now() - m.episodesFetchedAt.getTime() > maxAge;

/** Fetches and saves a show's episode list unless a recent copy is saved. */
export async function ensureEpisodeList(media: Media) {
  if (hasEpisodes(media) && isStale(media, MAX_AGE_MS)) await refresh(media);
}

/** A show's saved episode list, fetching it first if needed. */
export async function getEpisodeList(media: Media) {
  if (!hasEpisodes(media)) return [];
  await ensureEpisodeList(media);
  return db.mediaEpisode.findMany({ where: { mediaId: media.id }, orderBy: { number: "asc" } });
}

/** The name (and season, for TV) of an overall episode number. */
export async function getEpisodeInfo(media: Media, episode: number): Promise<EpisodeInfo> {
  if (!hasEpisodes(media)) return NONE;
  const refreshed = isStale(media, MAX_AGE_MS);
  if (refreshed) await refresh(media);

  const find = () =>
    db.mediaEpisode.findUnique({ where: { mediaId_number: { mediaId: media.id, number: episode } } });
  let row = await find();
  // Not in the list (or unnamed) yet: it may have been added since the last fetch.
  if (!row?.title && !refreshed && isStale(media, MISSING_RETRY_MS)) {
    await refresh(media);
    row = await find();
  }

  const info = row
    ? { season: row.season, seasonEpisode: row.seasonEpisode, title: row.title }
    : NONE;
  if (!info.title && media.source === "ANILIST") {
    return { ...info, title: await getJikanTitle(media.externalId, episode) };
  }
  return info;
}

// --- Anime ------------------------------------------------------------------

type AniEpisodes = {
  data: {
    Media: {
      idMal: number | null;
      streamingEpisodes: { title: string | null; thumbnail: string | null }[];
    };
  } | null;
};

async function getAniList(anilistId: string) {
  const res = await getJson<AniEpisodes>("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query ($id: Int) { Media(id: $id) { idMal streamingEpisodes { title thumbnail } } }`,
      variables: { id: Number(anilistId) },
    }),
  });
  return res?.data?.Media ?? null;
}

const KITSU = "https://kitsu.app/api/edge";
const KITSU_HEADERS = { Accept: "application/vnd.api+json" };
const KITSU_PAGE = 20; // Kitsu's largest page size for episodes
const KITSU_MAX_PAGES = 100; // 2000 episodes is plenty

type KitsuEpisode = {
  attributes?: {
    number?: number | null;
    canonicalTitle?: string | null;
    titles?: Record<string, string> | null;
    thumbnail?: { original?: string; medium?: string; small?: string } | null;
    airdate?: string | null;
    length?: number | null;
  };
};

async function getKitsuId(malId: number) {
  const res = await getJson<{ data?: { relationships?: { item?: { data?: { id: string } } } }[] }>(
    `${KITSU}/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&include=item&fields[anime]=id`,
    { headers: KITSU_HEADERS },
  );
  return res ? (res.data?.[0]?.relationships?.item?.data?.id ?? null) : undefined;
}

async function getKitsuEpisodes(kitsuId: string): Promise<KitsuEpisode[] | null> {
  const page = (offset: number) =>
    getJson<{ data?: KitsuEpisode[]; meta?: { count?: number } }>(
      `${KITSU}/anime/${kitsuId}/episodes?sort=number&page[limit]=${KITSU_PAGE}&page[offset]=${offset}` +
        `&fields[episodes]=number,canonicalTitle,titles,thumbnail,airdate,length`,
      { headers: KITSU_HEADERS },
      8000,
    );
  const first = await page(0);
  if (!first) return null;
  const count = Math.min(first.meta?.count ?? 0, KITSU_PAGE * KITSU_MAX_PAGES);

  // Fetch the rest a few pages at a time, so long shows don't take ages.
  const offsets = [];
  for (let o = KITSU_PAGE; o < count; o += KITSU_PAGE) offsets.push(o);
  const all = [...(first.data ?? [])];
  for (let i = 0; i < offsets.length; i += 5) {
    const pages = await Promise.all(offsets.slice(i, i + 5).map(page));
    if (pages.some((p) => !p)) return null;
    for (const p of pages) all.push(...(p!.data ?? []));
  }
  return all;
}

// Placeholder names like "Episode 3" aren't worth showing.
const realName = (t: string | null | undefined) =>
  t && !/^Episode \d+$/i.test(t.trim()) ? t.trim() : null;

/** Kitsu's list merged with AniList's streaming episodes; null if both failed. */
async function fetchAnimeList(anilistId: string): Promise<EpisodeRow[] | null> {
  const ani = await getAniList(anilistId);
  if (!ani) return null;
  const rows = new Map<number, EpisodeRow>();
  const row = (number: number) => {
    if (!rows.has(number)) {
      rows.set(number, {
        number,
        season: null,
        seasonEpisode: null,
        title: null,
        thumbnailUrl: null,
        airDate: null,
        runtime: null,
      });
    }
    return rows.get(number)!;
  };

  if (ani.idMal) {
    const kitsuId = await getKitsuId(ani.idMal);
    if (kitsuId === undefined) return null; // Kitsu unreachable: try again later
    const episodes = kitsuId ? await getKitsuEpisodes(kitsuId) : [];
    if (episodes === null) return null;
    for (const e of episodes) {
      const a = e.attributes;
      if (!a?.number) continue;
      const r = row(a.number);
      // Prefer an English name; canonicalTitle can be romaji.
      r.title = realName(a.titles?.en ?? a.titles?.en_us ?? a.canonicalTitle);
      r.thumbnailUrl = a.thumbnail?.small ?? a.thumbnail?.medium ?? a.thumbnail?.original ?? null;
      r.airDate = parseDay(a.airdate);
      r.runtime = a.length ?? null;
    }
  }

  // Streaming titles look like "Episode 5 - Phantoms of the Dead". They're the
  // official English names, so they win over Kitsu's.
  for (const s of ani.streamingEpisodes ?? []) {
    const m = s.title?.match(/^Episode\s+(\d+)\s*[-–:]\s*(.+)$/i);
    if (!m) continue;
    const r = row(Number(m[1]));
    r.title = realName(m[2]) ?? r.title;
    r.thumbnailUrl ??= s.thumbnail;
  }
  return [...rows.values()];
}

async function getJikanTitle(anilistId: string, episode: number) {
  const ani = await getAniList(anilistId);
  if (!ani?.idMal) return null;
  const res = await getJson<{ data?: { title?: string } }>(
    `https://api.jikan.moe/v4/anime/${ani.idMal}/episodes/${episode}`,
  );
  return realName(res?.data?.title);
}

// --- TV ---------------------------------------------------------------------

const STILL_BASE = "https://image.tmdb.org/t/p/w300";
const SEASONS_PER_REQUEST = 20; // TMDB's append_to_response limit

type TmdbSeason = {
  episodes?: {
    episode_number: number;
    name: string | null;
    still_path: string | null;
    air_date: string | null;
    runtime: number | null;
  }[];
};

/** Every regular season's episodes, numbered overall like Entry.progress. */
async function fetchTvList(tmdbId: string): Promise<EpisodeRow[] | null> {
  const headers = { Authorization: `Bearer ${process.env.TMDB_READ_TOKEN}` };
  const show = await getJson<{ seasons?: { season_number: number }[] }>(
    `https://api.themoviedb.org/3/tv/${tmdbId}`,
    { headers },
  );
  if (!show) return null;
  // Season 0 is specials, which don't count toward progress.
  const seasonNumbers = (show.seasons ?? [])
    .map((s) => s.season_number)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);

  const seasons = new Map<number, TmdbSeason>();
  for (let i = 0; i < seasonNumbers.length; i += SEASONS_PER_REQUEST) {
    const chunk = seasonNumbers.slice(i, i + SEASONS_PER_REQUEST);
    const res = await getJson<Record<string, TmdbSeason>>(
      `https://api.themoviedb.org/3/tv/${tmdbId}?append_to_response=${chunk.map((n) => `season/${n}`).join(",")}`,
      { headers },
      8000,
    );
    if (!res) return null;
    for (const n of chunk) seasons.set(n, res[`season/${n}`] ?? {});
  }

  const rows: EpisodeRow[] = [];
  for (const n of seasonNumbers) {
    for (const e of seasons.get(n)?.episodes ?? []) {
      rows.push({
        number: rows.length + 1,
        season: n,
        seasonEpisode: e.episode_number,
        title: realName(e.name),
        thumbnailUrl: e.still_path ? `${STILL_BASE}${e.still_path}` : null,
        airDate: parseDay(e.air_date),
        runtime: e.runtime,
      });
    }
  }
  return rows;
}
