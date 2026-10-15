-- AlterTable
ALTER TABLE "Case" ADD COLUMN "coreApplicationId" TEXT,
ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'screening_handoff';
