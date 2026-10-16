-- #155 review: the email and phone each profile version recorded, apart from the candidate identity record.
ALTER TABLE "CandidateProfile" ADD COLUMN "contact" JSONB;
