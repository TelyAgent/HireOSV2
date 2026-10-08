-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Written',
    "roles" JSONB NOT NULL,
    "competencies" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'Medium',
    "estMinutes" INTEGER NOT NULL DEFAULT 120,
    "language" TEXT NOT NULL DEFAULT '中文',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'published',
    "author" TEXT,
    "deliverables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_workspaceId_createdAt_idx" ON "Question"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Question_workspaceId_code_key" ON "Question"("workspaceId", "code");
