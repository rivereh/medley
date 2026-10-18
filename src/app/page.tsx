import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <h1 className="text-4xl font-bold">Track everything you watch and play.</h1>
      <p className="text-muted">
        Movies, shows, anime and games, all in one list.
      </p>
      <div className="flex gap-3">
        <Link href="/search" className="rounded bg-accent px-4 py-2 font-medium text-black">
          Search titles
        </Link>
        <Link href="/list" className="rounded bg-surface px-4 py-2 font-medium">
          My list
        </Link>
      </div>
    </div>
  );
}
