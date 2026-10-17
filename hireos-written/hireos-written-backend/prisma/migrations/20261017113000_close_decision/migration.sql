-- Null preserves unknown audit details on historical decisions.
ALTER TABLE "Case" ADD COLUMN "closeDecision" JSONB;
