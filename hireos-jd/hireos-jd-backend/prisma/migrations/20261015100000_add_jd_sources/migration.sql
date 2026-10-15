-- CreateTable
CREATE TABLE "JdSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "coreMaterialId" TEXT,
    "sourceService" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JdSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JdSource_workspaceId_contentHash_key" ON "JdSource"("workspaceId", "contentHash");

-- CreateIndex
CREATE INDEX "JdSource_workspaceId_jobId_idx" ON "JdSource"("workspaceId", "jobId");
