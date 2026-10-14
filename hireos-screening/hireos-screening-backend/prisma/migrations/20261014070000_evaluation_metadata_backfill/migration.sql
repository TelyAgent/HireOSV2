-- Issue #19: evaluations used to be stored as manual / not_requested / confidence 0.68 regardless of
-- how they were scored. Backfill from the evaluator recorded in each row's inputManifest.
-- Data only, no schema change. Rows whose evaluator is unknown are left untouched.

-- Scored by the AI evaluator: the model's confidence was copied onto every evaluated dimension.
UPDATE "ScreeningEvaluation" AS e
SET "evaluationMode" = 'ai',
    "aiStatus" = 'succeeded',
    "confidence" = (
      SELECT MAX(d."confidence") FROM "DimensionScore" AS d
      WHERE d."evaluationId" = e."id" AND d."status" = 'evaluated'
    )
WHERE e."inputManifest"->>'evaluator' LIKE 'ai-screening-evaluator-%';

-- Scored by the local rules: no AI involved and no calibrated overall confidence.
UPDATE "ScreeningEvaluation"
SET "evaluationMode" = 'rules',
    "aiStatus" = 'not_used',
    "confidence" = NULL
WHERE "inputManifest"->>'evaluator' LIKE 'local-rule-evaluator-%';
