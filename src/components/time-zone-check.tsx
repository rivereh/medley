"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Shows the server's time zone, and warns when it differs from this browser's:
 * dates like "Completed on" are decided on the server, so a server in the
 * wrong zone (e.g. a Docker container left on UTC) logs evening activity on
 * the wrong day.
 */
export function TimeZoneCheck({ serverZone }: { serverZone: string }) {
  const browserZone = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const mismatch = browserZone !== null && browserZone !== serverZone;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        Server time zone: <span className="font-medium">{serverZone}</span>
      </p>
      {mismatch && (
        <p className="text-amber-300">
          This doesn’t match your browser ({browserZone}), so things you log in the evening can be
          dated the next day. Set <code className="rounded bg-background px-1">TZ={browserZone}</code>{" "}
          in Medley’s settings (in CasaOS: the app’s environment variables) and restart it.
        </p>
      )}
    </div>
  );
}
