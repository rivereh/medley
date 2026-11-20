import Image from "next/image";

/**
 * Poster image. By default it keeps a 2:3 shape; with `fill` it stretches to
 * its parent's height instead (cropping slightly if needed). Pass `eager` for
 * images that start on screen, so the browser doesn't wait to fetch them.
 */
export function Poster({
  src,
  alt,
  fill = false,
  sizes = "(min-width: 1024px) 16vw, 45vw",
  eager = false,
}: {
  src: string | null;
  alt: string;
  fill?: boolean;
  sizes?: string;
  eager?: boolean;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded ${fill ? "h-full bg-background" : "aspect-[2/3] bg-surface"}`}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">
          {alt}
        </div>
      )}
    </div>
  );
}
