-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EpisodeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "episode" INTEGER NOT NULL,
    "season" INTEGER,
    "seasonEpisode" INTEGER,
    "title" TEXT,
    "watchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EpisodeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EpisodeLog_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EpisodeLog_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EpisodeLog" ("entryId", "episode", "id", "mediaId", "season", "seasonEpisode", "title", "userId", "watchedAt") SELECT "entryId", "episode", "id", "mediaId", "season", "seasonEpisode", "title", "userId", "watchedAt" FROM "EpisodeLog";
DROP TABLE "EpisodeLog";
ALTER TABLE "new_EpisodeLog" RENAME TO "EpisodeLog";
CREATE INDEX "EpisodeLog_userId_watchedAt_idx" ON "EpisodeLog"("userId", "watchedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
