import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundles just the files the server needs into .next/standalone, which
  // `npm run package` turns into the portable Medley folder.
  output: "standalone",
  cacheComponents: true,
  // There's no home page: My list is the start page.
  async redirects() {
    return [{ source: "/", destination: "/list", permanent: false }];
  },
  partialPrefetching: true,
  images: {
    // Posters and banners never change at a given URL, so keep resized copies
    // for a month instead of the default 4 hours.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "images.igdb.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
