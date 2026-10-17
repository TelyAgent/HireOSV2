CREATE TABLE "EvaluationPackageEvent" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "packageVersion" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "role" TEXT,
    "hrConfirmedAt" TIMESTAMP(3),
    "hmConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvaluationPackageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EvaluationPackageEvent_workspaceId_taskId_createdAt_idx" ON "EvaluationPackageEvent"("workspaceId", "taskId", "createdAt");
CREATE UNIQUE INDEX "EvaluationPackageEvent_sequence_key" ON "EvaluationPackageEvent"("sequence");
ALTER TABLE "EvaluationPackageEvent" ADD CONSTRAINT "EvaluationPackageEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "InterviewTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
