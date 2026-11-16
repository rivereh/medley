import "server-only";

// Checks GitHub for a newer Medley release. Only the public releases API is
// called, with no details about this install, and the answer is cached.

const REPO = "rivereh/medley";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const RETRY_FAILED_MS = 60 * 60 * 1000;

export const CURRENT_VERSION = process.env.MEDLEY_VERSION ?? "0.0.0";

/** How this copy was installed, for the update instructions. */
export const INSTALL = process.env.MEDLEY_DOCKER ? "docker" : "windows";

export type UpdateInfo = {
  current: string;
  latest: string | null;
  url: string | null;
  available: boolean;
  install: typeof INSTALL;
};

type Release = { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean };

let cached: { at: number; ttl: number; release: Release | null } | null = null;

/** "v1.2" / "1.2.0" -> [1, 2, 0]; anything after the numbers is ignored. */
function parse(version: string) {
  return (version.replace(/^v/i, "").match(/^[\d.]+/)?.[0] ?? "0")
    .split(".")
    .filter(Boolean)
    .map(Number);
}

export function isNewer(latest: string, current: string) {
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d > 0;
  }
  return false;
}

async function latestRelease(): Promise<Release | null> {
  if (cached && Date.now() - cached.at < cached.ttl) return cached.release;
  let release: Release | null = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Medley" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) release = await res.json();
  } catch {
    // Offline or rate limited: try again later.
  }
  cached = { at: Date.now(), ttl: release ? CHECK_EVERY_MS : RETRY_FAILED_MS, release };
  return release;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const off = /^(0|false|no|off)$/i.test(process.env.MEDLEY_UPDATE_CHECK ?? "");
  const release = off ? null : await latestRelease();
  const latest = release?.tag_name ?? null;
  return {
    current: CURRENT_VERSION,
    latest,
    url: release?.html_url ?? null,
    available: Boolean(latest && !release?.draft && !release?.prerelease && isNewer(latest, CURRENT_VERSION)),
    install: INSTALL,
  };
}
