-- AlterTable
ALTER TABLE "InterviewTask" ADD COLUMN     "decision" TEXT,
ADD COLUMN     "decisionAt" TIMESTAMP(3),
ADD COLUMN     "decisionConclusion" TEXT,
ADD COLUMN     "decisionSourceJobId" TEXT,
ADD COLUMN     "decisionSuggested" TEXT;
