CREATE TABLE "core_record"."RoleDefinitionVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'jd_module',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "roleSummary" TEXT,
    "responsibilities" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "dimensions" JSONB NOT NULL,
    "evaluationReadiness" TEXT NOT NULL DEFAULT 'needs_configuration',
    "hiringContext" JSONB,
    "successCriteria" JSONB,
    "internalCompensation" JSONB,
    "publicCompensation" JSONB,
    "sourceRefs" JSONB NOT NULL,
    "confirmationRef" JSONB,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoleDefinitionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_record"."JobRequirementSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "roleVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "audience" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "consumerModule" TEXT,
    "profileProjection" JSONB NOT NULL,
    "jdText" TEXT,
    "policyRefs" JSONB NOT NULL,
    "confirmationRef" JSONB,
    "sourceHash" TEXT NOT NULL,
    "projectionHash" TEXT NOT NULL,
    "projectionSchema" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobRequirementSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoleDefinitionVersion_workspaceId_jobId_versionNo_key"
ON "core_record"."RoleDefinitionVersion"("workspaceId", "jobId", "versionNo");

CREATE INDEX "RoleDefinitionVersion_workspaceId_jobId_status_idx"
ON "core_record"."RoleDefinitionVersion"("workspaceId", "jobId", "status");

CREATE UNIQUE INDEX "JobRequirementSnapshot_workspaceId_roleVersionId_purpose_consumerModule_key"
ON "core_record"."JobRequirementSnapshot"("workspaceId", "roleVersionId", "purpose", "consumerModule");

CREATE INDEX "JobRequirementSnapshot_workspaceId_jobId_status_idx"
ON "core_record"."JobRequirementSnapshot"("workspaceId", "jobId", "status");

ALTER TABLE "core_record"."RoleDefinitionVersion"
ADD CONSTRAINT "RoleDefinitionVersion_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "core_record"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core_record"."JobRequirementSnapshot"
ADD CONSTRAINT "JobRequirementSnapshot_jobId_fkey"
FOREIGN KEY ("jobId") REFERENCES "core_record"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core_record"."JobRequirementSnapshot"
ADD CONSTRAINT "JobRequirementSnapshot_roleVersionId_fkey"
FOREIGN KEY ("roleVersionId") REFERENCES "core_record"."RoleDefinitionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
