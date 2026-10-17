CREATE TABLE "RubricExport" (
 "id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "jobId" TEXT NOT NULL,
 "actorId" TEXT NOT NULL, "requestId" TEXT NOT NULL, "rubricId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL, "versionNumber" INTEGER NOT NULL, "rubricStatus" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending', "errorCode" TEXT,
 "pdf" BYTEA, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "RubricExport_workspaceId_actorId_requestId_key" ON "RubricExport"("workspaceId", "actorId", "requestId");
CREATE INDEX "RubricExport_workspaceId_jobId_createdAt_idx" ON "RubricExport"("workspaceId", "jobId", "createdAt");
