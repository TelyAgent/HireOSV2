-- CreateTable
CREATE TABLE "JobDocumentSuggestion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "anchorBlock" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "author" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "instruction" TEXT NOT NULL DEFAULT '',
    "oldText" TEXT NOT NULL,
    "newText" TEXT NOT NULL,
    "newItems" JSONB,
    "reason" TEXT NOT NULL DEFAULT '',
    "staleReason" TEXT,
    "supersedes" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDocumentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobDocumentSuggestion_workspaceId_jobId_audience_idx" ON "JobDocumentSuggestion"("workspaceId", "jobId", "audience");
