CREATE TABLE "EvaluationPackageVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationPackageVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EvaluationPackageVersion_taskId_version_key" ON "EvaluationPackageVersion"("taskId", "version");
CREATE INDEX "EvaluationPackageVersion_workspaceId_taskId_idx" ON "EvaluationPackageVersion"("workspaceId", "taskId");
ALTER TABLE "EvaluationPackageVersion" ADD CONSTRAINT "EvaluationPackageVersion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "InterviewTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
