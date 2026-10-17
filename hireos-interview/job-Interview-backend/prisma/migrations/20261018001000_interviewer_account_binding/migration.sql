CREATE TABLE "InterviewerAccountBinding" (
  "interviewerId" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "boundBy" TEXT NOT NULL,
  "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterviewerAccountBinding_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "Interviewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "InterviewerAccountBinding_workspaceId_accountId_idx" ON "InterviewerAccountBinding"("workspaceId", "accountId");
