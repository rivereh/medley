-- AlterTable
ALTER TABLE "Media" ADD COLUMN "episodesFetchedAt" DATETIME;

-- CreateTable
CREATE TABLE "MediaEpisode" (
    "mediaId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "season" INTEGER,
    "seasonEpisode" INTEGER,
    "title" TEXT,
    "thumbnailUrl" TEXT,
    "airDate" DATETIME,
    "runtime" INTEGER,

    PRIMARY KEY ("mediaId", "number"),
    CONSTRAINT "MediaEpisode_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
