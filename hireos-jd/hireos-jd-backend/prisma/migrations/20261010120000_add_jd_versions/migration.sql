-- CreateTable
CREATE TABLE "JdCode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JdCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDocumentVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "meta" JSONB,
    "note" TEXT NOT NULL DEFAULT '',
    "publishedBy" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JdCode_workspaceId_jobId_key" ON "JdCode"("workspaceId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JdCode_workspaceId_code_key" ON "JdCode"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JobDocumentVersion_workspaceId_jobId_versionNo_key" ON "JobDocumentVersion"("workspaceId", "jobId", "versionNo");

