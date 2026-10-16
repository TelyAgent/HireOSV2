-- #160 #167: identity the user confirmed when pasting a resume.
ALTER TABLE "Material" ADD COLUMN "confirmedIdentity" JSONB;
