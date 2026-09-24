-- AlterTable
ALTER TABLE "CardScore" ADD COLUMN     "aiGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "aiQuote" TEXT,
ADD COLUMN     "aiQuoteSegmentId" TEXT,
ADD COLUMN     "aiRationale" TEXT,
ADD COLUMN     "aiScore" INTEGER;

-- AlterTable
ALTER TABLE "ParseJob" ADD COLUMN     "roundId" TEXT;

-- CreateIndex
CREATE INDEX "ParseJob_roundId_inputVersion_idx" ON "ParseJob"("roundId", "inputVersion");

-- AddForeignKey
ALTER TABLE "ParseJob" ADD CONSTRAINT "ParseJob_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
