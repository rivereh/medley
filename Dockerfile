# Medley as a Docker image (used for CasaOS; see docker/casaos.yml).
# Built and published by .github/workflows/docker.yml for each release.

# --- Build ------------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /src
# Only needed if better-sqlite3 has no prebuilt binary for this platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install first (postinstall runs `prisma generate`, which needs the schema),
# so dependency layers are reused when only the code changes.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
ARG MEDLEY_VERSION=""
ENV MEDLEY_VERSION=$MEDLEY_VERSION NEXT_TELEMETRY_DISABLED=1
RUN node node_modules/next/dist/bin/next build

# Same layout as the Windows package's app folder (scripts/package.mjs).
RUN mkdir -p /app \
  && cp -r .next/standalone/. /app/ \
  && cp -r .next/static /app/.next/static \
  && if [ -d public ]; then cp -r public /app/public; fi \
  && cp -r prisma/migrations /app/migrations \
  && cp launcher/migrate.cjs docker/start.cjs /app/ \
  && rm -f /app/.env* /app/*.db

# --- Run --------------------------------------------------------------------
FROM node:24-bookworm-slim
WORKDIR /app
ARG MEDLEY_VERSION=""
ENV MEDLEY_VERSION=$MEDLEY_VERSION NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 HOSTNAME=0.0.0.0 MEDLEY_DATA_DIR=/data MEDLEY_DOCKER=1
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
CMD ["node", "start.cjs"]
