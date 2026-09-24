-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'optional',
    "status" TEXT NOT NULL DEFAULT 'awaiting_submission',
    "questionCode" TEXT NOT NULL,
    "questionTitle" TEXT NOT NULL,
    "questionPrompt" TEXT NOT NULL,
    "customPrompt" TEXT,
    "competencies" JSONB,
    "deliverables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanItem_workspaceId_caseId_idx" ON "PlanItem"("workspaceId", "caseId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
