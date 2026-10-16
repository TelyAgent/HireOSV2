-- #121: the automatic scoring of a submission is tracked on its own, so answering the candidate never waits for it.
ALTER TABLE "Submission" ADD COLUMN "evaluationStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Submission" ADD COLUMN "evaluationError" TEXT;
ALTER TABLE "Submission" ADD COLUMN "evaluationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Submission" ADD COLUMN "evaluationStartedAt" TIMESTAMP(3);

-- Existing submissions were scored (or not) inline at submit time: keep that outcome, don't run them again.
UPDATE "Submission" SET "evaluationStatus" = CASE WHEN "evaluation" IS NOT NULL THEN 'done' ELSE 'failed' END, "evaluationAttempts" = 1;
