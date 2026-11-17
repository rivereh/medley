-- AlterTable
ALTER TABLE "Media" ADD COLUMN "chapters" INTEGER;

-- CreateTable
CREATE TABLE "ChapterLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "fromChapter" INTEGER NOT NULL,
    "toChapter" INTEGER NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChapterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChapterLog_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChapterLog_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChapterLog_userId_readAt_idx" ON "ChapterLog"("userId", "readAt");
