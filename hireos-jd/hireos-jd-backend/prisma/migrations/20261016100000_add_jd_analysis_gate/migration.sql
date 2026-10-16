-- Store the latest AI review alongside the exact saved document revision it covered.
ALTER TABLE "JobDocument" ADD COLUMN "aiAnalysis" JSONB;
ALTER TABLE "JobDocument" ADD COLUMN "aiAnalysisRevision" INTEGER;
