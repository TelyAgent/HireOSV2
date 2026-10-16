-- #68: per-field source / revision / confirmation status of a Copilot draft.
ALTER TABLE "CopilotConversation" ADD COLUMN "fieldMeta" JSONB NOT NULL DEFAULT '{}';
