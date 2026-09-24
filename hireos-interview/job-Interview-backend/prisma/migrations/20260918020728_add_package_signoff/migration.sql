-- AlterTable
ALTER TABLE "InterviewTask" ADD COLUMN     "hmConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "hmConfirmedBy" TEXT,
ADD COLUMN     "hrConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "hrConfirmedBy" TEXT,
ADD COLUMN     "offerSentAt" TIMESTAMP(3),
ADD COLUMN     "offerState" TEXT NOT NULL DEFAULT 'none';
