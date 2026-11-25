import { connection } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES, type Category, type SearchResult } from "@/lib/sources";
import { searchCached } from "@/lib/sources/search-cache";
import { parseVideoId } from "@/lib/sources/youtube";
import { getCurrentUser } from "@/lib/user";

// Results per section in the header search's dropdown.
const LIMIT = 4;
const LIBRARY_LIMIT = 5;

/**
 * Header search, one section per request so each shows as soon as it's ready:
 *   ?q=…&source=library   titles on the user's list (database only, instant)
 *   ?q=…&source=<category> online results (cached; see search-cache.ts)
 */
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const source = url.searchParams.get("source") ?? "";
  if (query.length < 2) return Response.json({ results: [] });

  if (source === "library") {
    const user = await getCurrentUser();
    const media = await db.media.findMany({
      where: {
        entries: { some: { userId: user.id } },
        OR: [{ title: { contains: query } }, { creator: { contains: query } }],
      },
      orderBy: { updatedAt: "desc" },
      take: LIBRARY_LIMIT,
    });
    const results: SearchResult[] = media.map((m) => ({
      source: m.source,
      externalId: m.externalId,
      type: m.type,
      title: m.title,
      year: m.year,
      posterUrl: m.posterUrl,
      overview: m.creator ?? m.overview,
    }));
    return Response.json({ results });
  }

  if (!(source in CATEGORIES)) return Response.json({ error: "Unknown source" }, { status: 400 });
  const category = source as Category;
  // Without a key there's nothing to ask; YouTube only understands pasted links.
  if (!CATEGORIES[category].isConfigured()) return Response.json({ results: [] });
  if (category === "videos" && !parseVideoId(query)) return Response.json({ results: [] });

  try {
    const results = (await searchCached(category, query)).slice(0, LIMIT);
    return Response.json({ results });
  } catch (err) {
    console.error(err);
    return Response.json({ results: [], error: "Search failed" });
  }
}
