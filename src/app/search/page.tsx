import Link from "next/link";
import { Suspense } from "react";
import { ResultCard } from "@/components/result-card";
import { db } from "@/lib/db";
import { CATEGORIES, type Category } from "@/lib/sources";
import { getCurrentUser } from "@/lib/user";

const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];
// How many results each section shows on the "All" tab.
const PREVIEW_COUNT = 12;

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Search</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchBody({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const { q, cat } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const active = CATEGORY_KEYS.find((k) => k === cat) ?? null;
  const shown = active ? [active] : CATEGORY_KEYS;

  const tabHref = (c: Category | null) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (c) params.set("cat", c);
    return `/search?${params}`;
  };

  return (
    <>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search movies, shows, anime and games…"
          className="flex-1 rounded bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
          autoFocus
        />
        {active && <input type="hidden" name="cat" value={active} />}
        <button className="rounded bg-accent px-4 py-2 font-medium text-black">Search</button>
      </form>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Tab href={tabHref(null)} active={!active} label="All" />
        {CATEGORY_KEYS.map((c) => (
          <Tab key={c} href={tabHref(c)} active={active === c} label={CATEGORIES[c].label} />
        ))}
      </nav>

      {query &&
        shown.map((c) => (
          <section key={c} className="flex flex-col gap-3">
            {!active && (
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">{CATEGORIES[c].label}</h2>
                <Link href={tabHref(c)} className="text-sm text-muted hover:text-foreground">
                  See all →
                </Link>
              </div>
            )}
            <Suspense fallback={<p className="text-sm text-muted">Searching…</p>}>
              <ResultsSection
                category={c}
                query={query}
                limit={active ? undefined : PREVIEW_COUNT}
              />
            </Suspense>
          </section>
        ))}
    </>
  );
}

async function ResultsSection({
  category,
  query,
  limit,
}: {
  category: Category;
  query: string;
  limit?: number;
}) {
  const { search, isConfigured, setupHint } = CATEGORIES[category];
  if (!isConfigured()) return <p className="text-sm text-muted">{setupHint} to enable this.</p>;

  let results;
  try {
    results = (await search(query)).slice(0, limit);
  } catch (err) {
    console.error(err);
    return <p className="text-sm text-red-400">Search failed. Check the server logs.</p>;
  }
  if (results.length === 0) return <p className="text-sm text-muted">No results.</p>;

  // Which of these results are already on the user's list?
  const user = await getCurrentUser();
  const tracked = await db.entry.findMany({
    where: {
      userId: user.id,
      media: {
        source: results[0].source,
        externalId: { in: results.map((r) => r.externalId) },
      },
    },
    select: { status: true, media: { select: { externalId: true, type: true } } },
    // Oldest first, so the newest post's status wins in the map below.
    orderBy: { updatedAt: "asc" },
  });
  const statusByKey = new Map(tracked.map((t) => [`${t.media.type}:${t.media.externalId}`, t.status]));

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {results.map((r) => (
        <li key={`${r.type}-${r.externalId}`}>
          <ResultCard result={r} status={statusByKey.get(`${r.type}:${r.externalId}`) ?? null} />
        </li>
      ))}
    </ul>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 ${active ? "bg-accent text-black" : "bg-surface text-muted hover:text-foreground"}`}
    >
      {label}
    </Link>
  );
}
