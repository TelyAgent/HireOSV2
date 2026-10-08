-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "finalEvaluation" JSONB,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedBy" TEXT,
ADD COLUMN     "release" JSONB,
ADD COLUMN     "releasedAt" TIMESTAMP(3);
