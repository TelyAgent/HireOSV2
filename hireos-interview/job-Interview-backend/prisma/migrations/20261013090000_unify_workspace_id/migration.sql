-- Interview used a hard-coded workspace id (local-workspace) while every other subsystem stores
-- local-screening-workspace. The shared identity service issues sessions for the latter, so
-- interview rows move onto it. The dev default of WorkspaceGuard changes to match in the same release.
UPDATE "Interviewer" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "Job" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "Candidate" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "Resume" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "InterviewTask" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "InterviewRound" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "CardScore" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "TranscriptLine" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "RubricVersion" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "CapabilityCard" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "InterviewQuestion" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "Material" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "ParseJob" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
UPDATE "InterviewSession" SET "workspaceId" = 'local-screening-workspace' WHERE "workspaceId" = 'local-workspace';
