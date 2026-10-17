ALTER TABLE "Job" ADD COLUMN "jdRequirements" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CapabilityCard" ADD COLUMN "requiredLevel" INTEGER;
ALTER TABLE "CapabilityCard" ADD COLUMN "sourceRequirementId" TEXT;
ALTER TABLE "CapabilityCard" ADD CONSTRAINT "CapabilityCard_requiredLevel_check" CHECK ("requiredLevel" BETWEEN 1 AND 5);
