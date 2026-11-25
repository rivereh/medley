"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { UpdateInfo } from "@/lib/updates";

function useUpdateInfo() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/update")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => !cancelled && setInfo(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return info;
}

/** Header pill shown when GitHub has a newer release. */
export function UpdateNotice() {
  const info = useUpdateInfo();
  if (!info?.available) return null;
  return (
    <Link
      href="/settings#updates"
      className="hidden rounded-full bg-accent/15 sm:inline-block px-3 py-1 text-xs font-medium text-accent hover:bg-accent/25"
    >
      Update available: {info.latest}
    </Link>
  );
}

/** Settings section: current version, whether it's up to date, and how to update. */
export function UpdateStatus() {
  const info = useUpdateInfo();
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Version <span className="font-medium">{info?.current ?? "…"}</span>
        {info && (
          <span className={`ml-2 ${info.available ? "text-accent" : "text-muted"}`}>
            {info.available
              ? `· ${info.latest} is available`
              : info.latest
                ? "· Up to date"
                : "· Couldn’t check for updates"}
          </span>
        )}
      </p>
      {info?.available && (
        <>
          {info.install === "docker" ? (
            <p className="text-muted">
              Update the container to pull the new image. In CasaOS, use the app’s update option;
              with Docker Compose, run{" "}
              <code className="rounded bg-background px-1">docker compose pull && docker compose up -d</code>.
              Your data stays in its volume, and the database updates itself on start.
            </p>
          ) : (
            <p className="text-muted">
              Download the new Medley.zip, close Medley, and replace <code>Medley.exe</code> and the{" "}
              <code>app</code> folder. Keep <code>data</code> and <code>config.env</code>; the
              database updates itself on start.
            </p>
          )}
          {info.url && (
            <a
              href={info.url}
              target="_blank"
              rel="noreferrer"
              className="self-start text-accent underline"
            >
              Release notes and downloads
            </a>
          )}
        </>
      )}
    </div>
  );
}
