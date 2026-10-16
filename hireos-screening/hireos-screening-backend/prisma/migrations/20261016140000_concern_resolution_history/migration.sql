-- #193: every handling and reopening of a screening concern, with its note, evidence references, actor and time.
ALTER TABLE "ScreeningConcern" ADD COLUMN "resolutionHistory" JSONB NOT NULL DEFAULT '[]';
