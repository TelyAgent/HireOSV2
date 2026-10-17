ALTER TABLE "Question" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Question" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Question" ALTER COLUMN "version" SET DEFAULT 0;
ALTER TABLE "Question" ALTER COLUMN "status" SET DEFAULT 'draft_review';

CREATE TABLE "QuestionVersion" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "draftRevision" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "historicalBaseline" BOOLEAN NOT NULL DEFAULT false,
  "publishedBy" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuestionVersion_questionId_version_key" ON "QuestionVersion"("questionId", "version");
CREATE UNIQUE INDEX "QuestionVersion_questionId_draftRevision_key" ON "QuestionVersion"("questionId", "draftRevision");
CREATE INDEX "QuestionVersion_workspaceId_questionId_idx" ON "QuestionVersion"("workspaceId", "questionId");

-- Preserve only the currently available published contents, without inventing prior versions or publication facts.
INSERT INTO "QuestionVersion" ("id", "workspaceId", "questionId", "version", "draftRevision", "content", "historicalBaseline")
SELECT 'baseline:' || q."id", q."workspaceId", q."id", q."version", q."revision", to_jsonb(q) - 'workspaceId' - 'deletedAt', true
FROM "Question" q WHERE q."status" = 'published';

ALTER TABLE "PlanItem" ADD COLUMN "bankQuestionVersionId" TEXT;
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_bankQuestionVersionId_fkey" FOREIGN KEY ("bankQuestionVersionId") REFERENCES "QuestionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
