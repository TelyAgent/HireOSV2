CREATE SCHEMA IF NOT EXISTS "core_record";

CREATE TABLE "core_record"."Candidate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "identityStatus" TEXT NOT NULL DEFAULT 'provisional',
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "retentionPolicy" TEXT NOT NULL DEFAULT 'standard-24mo',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Candidate_workspaceId_createdAt_idx" ON "core_record"."Candidate"("workspaceId", "createdAt");
CREATE INDEX "Candidate_workspaceId_email_idx" ON "core_record"."Candidate"("workspaceId", "email");

CREATE TABLE "core_record"."CandidateStatusHistory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CandidateStatusHistory_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "core_record"."Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CandidateStatusHistory_workspaceId_candidateId_createdAt_idx" ON "core_record"."CandidateStatusHistory"("workspaceId", "candidateId", "createdAt");

CREATE TABLE "core_record"."Job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "team" TEXT,
    "location" TEXT,
    "employmentType" TEXT,
    "seniority" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "openings" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Job_workspaceId_status_createdAt_idx" ON "core_record"."Job"("workspaceId", "status", "createdAt");

CREATE TABLE "core_record"."JobStatusHistory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JobStatusHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "core_record"."Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JobStatusHistory_workspaceId_jobId_createdAt_idx" ON "core_record"."JobStatusHistory"("workspaceId", "jobId", "createdAt");

CREATE TABLE "core_record"."Application" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL DEFAULT 'cycle-1',
    "status" TEXT NOT NULL DEFAULT 'active',
    "origin" TEXT NOT NULL DEFAULT 'sourced',
    "linkReason" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "core_record"."Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "core_record"."Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Application_workspaceId_candidateId_jobId_cycleId_key" ON "core_record"."Application"("workspaceId", "candidateId", "jobId", "cycleId");
CREATE INDEX "Application_workspaceId_jobId_status_idx" ON "core_record"."Application"("workspaceId", "jobId", "status");
CREATE INDEX "Application_workspaceId_candidateId_status_idx" ON "core_record"."Application"("workspaceId", "candidateId", "status");

CREATE TABLE "core_record"."ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "core_record"."Application"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ApplicationStatusHistory_workspaceId_applicationId_createdAt_idx" ON "core_record"."ApplicationStatusHistory"("workspaceId", "applicationId", "createdAt");

CREATE TABLE "core_record"."Material" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "readStatus" TEXT NOT NULL DEFAULT 'pending',
    "securityStatus" TEXT NOT NULL DEFAULT 'not_scanned',
    "version" INTEGER NOT NULL DEFAULT 1,
    "candidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Material_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Material_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "core_record"."Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Material_workspaceId_hash_key" ON "core_record"."Material"("workspaceId", "hash");
CREATE INDEX "Material_workspaceId_createdAt_idx" ON "core_record"."Material"("workspaceId", "createdAt");
CREATE INDEX "Material_workspaceId_candidateId_idx" ON "core_record"."Material"("workspaceId", "candidateId");

CREATE TABLE "core_record"."IdempotencyKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdempotencyKey_workspaceId_operation_key_key" ON "core_record"."IdempotencyKey"("workspaceId", "operation", "key");
CREATE INDEX "IdempotencyKey_workspaceId_createdAt_idx" ON "core_record"."IdempotencyKey"("workspaceId", "createdAt");

CREATE TABLE "core_record"."AuditRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "beforeVersion" INTEGER,
    "afterVersion" INTEGER,
    "reason" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "sourceService" TEXT NOT NULL DEFAULT 'core-record',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditRecord_workspaceId_createdAt_idx" ON "core_record"."AuditRecord"("workspaceId", "createdAt");
CREATE INDEX "AuditRecord_workspaceId_objectType_objectId_idx" ON "core_record"."AuditRecord"("workspaceId", "objectType", "objectId");

CREATE TABLE "core_record"."OutboxEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "correlationId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutboxEvent_workspaceId_status_createdAt_idx" ON "core_record"."OutboxEvent"("workspaceId", "status", "createdAt");
CREATE INDEX "OutboxEvent_workspaceId_aggregateType_aggregateId_idx" ON "core_record"."OutboxEvent"("workspaceId", "aggregateType", "aggregateId");
