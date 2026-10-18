"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A <select> that writes its value to a URL search param. */
export function UrlSelect({
  param,
  value,
  options,
  label,
}: {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams);
          params.set(param, e.target.value);
          router.push(`${pathname}?${params}`);
        }}
        className="rounded bg-surface px-2 py-1 text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
