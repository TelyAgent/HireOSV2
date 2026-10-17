ALTER TABLE "InterviewTask" ADD COLUMN "decisionReason" TEXT,
  ADD COLUMN "decisionBy" TEXT,
  ADD COLUMN "decisionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "RoundQuestionSkip" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "skippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot" JSONB NOT NULL,
  CONSTRAINT "RoundQuestionSkip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoundQuestionSkip_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoundQuestionSkip_roundId_questionId_key" ON "RoundQuestionSkip"("roundId", "questionId");
CREATE INDEX "RoundQuestionSkip_workspaceId_roundId_idx" ON "RoundQuestionSkip"("workspaceId", "roundId");
