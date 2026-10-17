CREATE TABLE "QuestionDeprecation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "QuestionDeprecation_questionId_version_key" ON "QuestionDeprecation"("questionId", "version");
CREATE INDEX "QuestionDeprecation_workspaceId_questionId_idx" ON "QuestionDeprecation"("workspaceId", "questionId");
