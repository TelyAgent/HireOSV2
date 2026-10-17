ALTER TABLE "InterviewTask" ADD COLUMN "screeningRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentScreeningId" TEXT;
CREATE TABLE "ScreeningResolution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES "InterviewTask"("id") ON DELETE CASCADE,
  "revision" INTEGER NOT NULL,
  "selectedMaterialId" TEXT NOT NULL,
  "memberIds" JSONB NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ScreeningResolution_taskId_revision_key" ON "ScreeningResolution"("taskId", "revision");
