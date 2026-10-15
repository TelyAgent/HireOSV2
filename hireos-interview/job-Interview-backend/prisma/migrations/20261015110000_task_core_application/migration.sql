-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "possibleDuplicate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InterviewTask" ADD COLUMN "coreApplicationId" TEXT,
ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'manual';

-- Backfill: tasks that arrived from Screening
UPDATE "InterviewTask" SET "origin" = 'screening_handoff' WHERE "screeningHandedOffAt" IS NOT NULL;
