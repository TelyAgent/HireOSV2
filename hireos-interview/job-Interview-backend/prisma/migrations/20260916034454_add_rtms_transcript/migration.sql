-- AlterTable
ALTER TABLE "InterviewRound" ADD COLUMN     "transcriptError" TEXT,
ADD COLUMN     "transcriptStatus" TEXT NOT NULL DEFAULT 'idle';

-- CreateTable
CREATE TABLE "TranscriptLine" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptLine_roundId_createdAt_idx" ON "TranscriptLine"("roundId", "createdAt");

-- AddForeignKey
ALTER TABLE "TranscriptLine" ADD CONSTRAINT "TranscriptLine_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
