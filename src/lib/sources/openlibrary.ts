import "server-only";
import type { MediaDetails, SearchResult } from "./types";

// Open Library's public API needs no key. It asks for a descriptive User-Agent.
// Books are "works" (e.g. OL21745884W), which group a book's many editions;
// the page count is the median across editions, so it isn't tied to one printing.
const API = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org/b/id";
const HEADERS = { "User-Agent": "Medley (personal media tracker)", Accept: "application/json" };

const SEARCH_FIELDS = [
  "key",
  "title",
  "author_name",
  "first_publish_year",
  "cover_i",
  "number_of_pages_median",
  "edition_count",
  "subject",
].join(",");

type OlDoc = {
  key: string; // "/works/OL21745884W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  edition_count?: number;
  subject?: string[];
};

type OlWork = {
  description?: string | { value?: string };
  subjects?: string[];
};

async function ol<T>(path: string, timeout = 10_000): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`Open Library request failed: ${res.status}`);
  return res.json();
}

const cover = (id: number | undefined, size: "M" | "L") => (id ? `${COVERS}/${id}-${size}.jpg` : null);
const workId = (key: string) => key.replace("/works/", "");

/** Descriptions often end with a list of links or a source note; keep the prose. */
function cleanDescription(d: OlWork["description"]) {
  const text = typeof d === "string" ? d : d?.value;
  if (!text) return null;
  return (
    text
      .split(/\n-{3,}|\n\s*\*\*?(?:Contains|Also contained|See also)/i)[0]
      // Markdown links -> their text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
}

const CATALOG_TAG =
  /new york times|bestseller|reviewed|award|accessible book|protected daisy|in library|large type|staff picks|translations? into|^fiction$/i;

/** Readable genres from Open Library's noisy subject list. */
function genres(subjects: string[] | undefined) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of subjects ?? []) {
    // Skip tags like "nyt:hardcover-fiction=2021-05-23", long catalog headings,
    // and Open Library's own collection tags.
    if (/[:=]/.test(s) || s.length > 30 || CATALOG_TAG.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.replace(/\b\w/g, (c) => c.toUpperCase()));
    if (out.length === 6) break;
  }
  return out;
}

function toResult(d: OlDoc): SearchResult {
  const authors = d.author_name?.slice(0, 2).join(", ");
  return {
    source: "OPENLIBRARY",
    externalId: workId(d.key),
    type: "BOOK",
    title: d.title,
    year: d.first_publish_year ?? null,
    posterUrl: cover(d.cover_i, "L"),
    overview: authors ? `By ${authors}` : null,
  };
}

export async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: "30", fields: SEARCH_FIELDS });
  const data = await ol<{ docs: OlDoc[] }>(`/search.json?${params}`);
  // Knock-offs ("Summary of …") have one edition and no cover or page count.
  const real = data.docs.filter(
    (d) => d.cover_i || d.number_of_pages_median || (d.edition_count ?? 0) > 1,
  );
  return real.map(toResult);
}

export async function getOpenLibraryDetails(id: string): Promise<MediaDetails> {
  const fields = `${SEARCH_FIELDS},publisher`;
  const [search, work, ratings] = await Promise.all([
    ol<{ docs: (OlDoc & { publisher?: string[] })[] }>(
      `/search.json?q=key:/works/${encodeURIComponent(id)}&fields=${fields}`,
    ),
    ol<OlWork>(`/works/${encodeURIComponent(id)}.json`),
    // Slow and only a nice-to-have.
    ol<{ summary?: { average?: number | null; count?: number } }>(
      `/works/${encodeURIComponent(id)}/ratings.json`,
      4000,
    ).catch(() => null),
  ]);
  const d = search.docs[0];
  if (!d) throw new Error(`Open Library work ${id} not found`);

  const avg = ratings?.summary?.average;
  const facts: MediaDetails["facts"] = [];
  if (d.author_name?.length) {
    facts.push({ label: d.author_name.length > 1 ? "Authors" : "Author", value: d.author_name.slice(0, 4).join(", ") });
  }
  if (d.number_of_pages_median) facts.push({ label: "Pages", value: String(d.number_of_pages_median) });
  if (d.first_publish_year) facts.push({ label: "First published", value: String(d.first_publish_year) });
  if (d.edition_count) facts.push({ label: "Editions", value: String(d.edition_count) });
  if (ratings?.summary?.count && avg) {
    facts.push({ label: "Open Library rating", value: `${avg.toFixed(1)} / 5 (${ratings.summary.count})` });
  }

  return {
    ...toResult(d),
    overview: cleanDescription(work.description),
    backdropUrl: null,
    genres: genres(work.subjects ?? d.subject),
    // Only when enough people have rated it to mean something.
    score: avg && (ratings?.summary?.count ?? 0) >= 5 ? Math.round((avg / 5) * 100) : null,
    totalUnits: d.number_of_pages_median ?? null,
    creator: d.author_name?.slice(0, 4).join(", ") || null,
    facts,
  };
}
