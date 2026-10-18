"use client";

import { useRef, useState } from "react";

type ImportResult = {
  titles: number;
  entriesAdded: number;
  entriesSkipped: number;
  episodesAdded: number;
  episodesSkipped: number;
};

/** Export your list to a JSON file, or import one back. */
export function DataTransfer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const runImport = async () => {
    if (!file) return;
    if (
      replace &&
      !confirm("Replace your whole list with this file? Everything currently on your list will be deleted.")
    ) {
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/import${replace ? "?replace=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: body.error ?? "Import failed." });
        return;
      }
      const r = body as ImportResult;
      const skipped = r.entriesSkipped + r.episodesSkipped;
      setMessage({
        ok: true,
        text:
          `Imported ${r.entriesAdded} post${r.entriesAdded === 1 ? "" : "s"} and ` +
          `${r.episodesAdded} episode${r.episodesAdded === 1 ? "" : "s"}` +
          (skipped ? ` (skipped ${skipped} already on your list).` : "."),
      });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setMessage({ ok: false, text: "Import failed. Nothing was changed." });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Export</h3>
        <p className="text-sm text-muted">
          Download everything on your list (posts, episodes, ratings, dates and settings) as one
          file.
        </p>
        <a
          href="/api/export"
          download
          className="self-start rounded bg-accent px-4 py-1.5 text-sm font-medium text-black"
        >
          Download export
        </a>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Import</h3>
        <p className="text-sm text-muted">
          Add everything from a Medley export file. Things already on your list are skipped, so
          importing the same file twice is safe.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setMessage(null);
          }}
          className="text-sm text-muted file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-white/10"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="size-4 accent-red-500"
          />
          Replace my current list instead of adding to it
        </label>
        <button
          type="button"
          onClick={runImport}
          disabled={!file || pending}
          className={`self-start rounded px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
            replace ? "bg-red-500 text-white" : "bg-accent text-black"
          }`}
        >
          {pending ? "Importing…" : replace ? "Replace and import" : "Import"}
        </button>
        {message && (
          <p className={`text-sm ${message.ok ? "text-accent" : "text-red-400"}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
