-- AlterTable
ALTER TABLE "MediaEpisode" ADD COLUMN "overview" TEXT;

-- Saved episode lists predate descriptions: fetch them again when next used.
UPDATE "Media" SET "episodesFetchedAt" = NULL WHERE "episodesFetchedAt" IS NOT NULL;
