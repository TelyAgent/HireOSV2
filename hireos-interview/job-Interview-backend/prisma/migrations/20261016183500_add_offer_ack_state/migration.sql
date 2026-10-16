ALTER TABLE "InterviewTask" ADD COLUMN "offerAckAt" TIMESTAMP(3);
ALTER TABLE "InterviewTask" ADD COLUMN "offerAttemptId" TEXT;
ALTER TABLE "InterviewTask" ADD COLUMN "offerPackageVersion" INTEGER;
ALTER TABLE "InterviewTask" ADD COLUMN "offerError" TEXT;
