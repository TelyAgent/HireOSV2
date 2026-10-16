-- #155: when the candidate can start, as the résumé states it.
ALTER TABLE "CandidateProfile" ADD COLUMN "availability" JSONB;
