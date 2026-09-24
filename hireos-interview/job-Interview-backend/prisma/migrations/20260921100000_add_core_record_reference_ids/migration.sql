-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "coreCandidateId" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "coreJobId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_coreCandidateId_key" ON "Candidate"("coreCandidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_coreJobId_key" ON "Job"("coreJobId");
