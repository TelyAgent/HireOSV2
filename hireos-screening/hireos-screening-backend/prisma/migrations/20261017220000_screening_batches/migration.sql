CREATE TABLE "ScreeningBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ScreeningBatch_workspaceId_idempotencyKey_key" ON "ScreeningBatch"("workspaceId", "idempotencyKey");
CREATE INDEX "ScreeningBatch_workspaceId_jobId_createdAt_idx" ON "ScreeningBatch"("workspaceId", "jobId", "createdAt");
CREATE TABLE "ScreeningBatchItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL REFERENCES "ScreeningBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "evaluationId" TEXT,
  "errorCode" TEXT,
  "retryKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScreeningBatchItem_status_check" CHECK ("status" IN ('queued','running','completed','failed','cancelled','unknown'))
);
CREATE UNIQUE INDEX "ScreeningBatchItem_batchId_applicationId_key" ON "ScreeningBatchItem"("batchId", "applicationId");
CREATE INDEX "ScreeningBatchItem_workspaceId_status_createdAt_idx" ON "ScreeningBatchItem"("workspaceId", "status", "createdAt");
