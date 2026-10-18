import "server-only";
import type { Media, MediaSource, MediaType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getDetails } from "./index";
import type { MediaDetails } from "./types";

// Title details (banner, genres, score, facts) are cached on the Media row so
// the details modal opens without waiting on TMDB / AniList / IGDB.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function fromRow(m: Media): MediaDetails {
  return {
    source: m.source,
    externalId: m.externalId,
    type: m.type,
    title: m.title,
    year: m.year,
    posterUrl: m.posterUrl,
    overview: m.overview,
    backdropUrl: m.backdropUrl,
    genres: parseJson<string[]>(m.genres, []),
    score: m.score,
    totalUnits: m.totalUnits,
    facts: parseJson<MediaDetails["facts"]>(m.facts, []),
  };
}

async function save(d: MediaDetails) {
  const fields = {
    type: d.type,
    title: d.title,
    posterUrl: d.posterUrl,
    year: d.year,
    overview: d.overview,
    totalUnits: d.totalUnits,
    backdropUrl: d.backdropUrl,
    genres: JSON.stringify(d.genres),
    score: d.score,
    facts: JSON.stringify(d.facts),
    detailsFetchedAt: new Date(),
  };
  await db.media.upsert({
    where: { source_externalId: { source: d.source, externalId: d.externalId } },
    update: fields,
    create: { source: d.source, externalId: d.externalId, ...fields },
  });
}

/**
 * Details from the cache when they're under a week old; otherwise fetched from
 * the source and saved. If the source can't be reached, a stale copy is
 * better than nothing.
 */
export async function getDetailsCached(
  source: MediaSource,
  type: MediaType,
  externalId: string,
): Promise<MediaDetails> {
  const cached = await db.media.findUnique({
    where: { source_externalId: { source, externalId } },
  });
  const fetchedAt = cached?.detailsFetchedAt?.getTime();
  if (cached && fetchedAt && Date.now() - fetchedAt < MAX_AGE_MS) return fromRow(cached);

  try {
    const details = await getDetails(source, type, externalId);
    await save(details);
    return details;
  } catch (err) {
    if (cached && fetchedAt) return fromRow(cached);
    throw err;
  }
}
