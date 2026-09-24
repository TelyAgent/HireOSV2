-- DropIndex
DROP INDEX "Job_workspaceId_createdBy_requestKey_key";
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "recruitingStatus",
DROP COLUMN "requestHash",
DROP COLUMN "requestKey",
DROP COLUMN "reviewed",
DROP COLUMN "version";
