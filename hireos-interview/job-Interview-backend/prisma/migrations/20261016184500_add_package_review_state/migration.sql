ALTER TABLE "InterviewTask" ADD COLUMN "packageNeedsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InterviewTask" ADD COLUMN "packageReviewReason" TEXT;
ALTER TABLE "InterviewTask" ADD COLUMN "packageInvalidatedAt" TIMESTAMP(3);
