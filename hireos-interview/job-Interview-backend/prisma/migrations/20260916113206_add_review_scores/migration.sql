-- AlterTable
ALTER TABLE "InterviewRound" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "recommendation" TEXT;

-- CreateTable
CREATE TABLE "CardScore" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "score" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardScore_cardId_idx" ON "CardScore"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardScore_roundId_cardId_key" ON "CardScore"("roundId", "cardId");

-- AddForeignKey
ALTER TABLE "CardScore" ADD CONSTRAINT "CardScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardScore" ADD CONSTRAINT "CardScore_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CapabilityCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
