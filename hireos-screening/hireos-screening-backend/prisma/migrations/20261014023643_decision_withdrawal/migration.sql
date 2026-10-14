-- AlterTable
ALTER TABLE "ScreeningDecision" ADD COLUMN     "withdrawReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnBy" TEXT;
