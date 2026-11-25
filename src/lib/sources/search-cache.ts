import "server-only";
import { CATEGORIES, type Category, type SearchResult } from "./index";

// Search results are cached in memory for a while, so the same query doesn't
// hit TMDB / AniList / IGDB / Open Library again: e.g. typing in the header
// search and then pressing Enter for the full search page, or typing,
// deleting and retyping a word. Identical searches running at the same time
// share one request.

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 300;

const cache = new Map<string, { at: number; results: Promise<SearchResult[]> }>();

export function searchCached(category: Category, query: string): Promise<SearchResult[]> {
  const key = `${category}:${query.trim().toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.results;

  const results = CATEGORIES[category].search(query.trim());
  cache.set(key, { at: Date.now(), results });
  // Failed searches aren't kept, so the next try asks again.
  results.catch(() => cache.delete(key));

  // Oldest entries go first (Maps keep insertion order).
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return results;
}
