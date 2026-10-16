-- #181: whether the résumé explicitly rules a role out, and the quoted statements that do.
ALTER TABLE "PreLinkMatchEvaluation" ADD COLUMN "eligibility" TEXT;
ALTER TABLE "PreLinkMatchEvaluation" ADD COLUMN "conflicts" JSONB;
