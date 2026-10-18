-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "rating" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "allAchievements" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Entry_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Entry" ("createdAt", "finishedAt", "id", "mediaId", "notes", "progress", "rating", "startedAt", "status", "updatedAt", "userId") SELECT "createdAt", "finishedAt", "id", "mediaId", "notes", "progress", "rating", "startedAt", "status", "updatedAt", "userId" FROM "Entry";
DROP TABLE "Entry";
ALTER TABLE "new_Entry" RENAME TO "Entry";
CREATE INDEX "Entry_userId_status_idx" ON "Entry"("userId", "status");
CREATE UNIQUE INDEX "Entry_userId_mediaId_key" ON "Entry"("userId", "mediaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Entries already marked completed count as one completion.
UPDATE "Entry" SET "completions" = 1 WHERE "status" = 'COMPLETED';
