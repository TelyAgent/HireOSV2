-- AlterTable: the draft intake wrote from the AI's reading of the JD, and its content hash
ALTER TABLE "JdSource" ADD COLUMN "draftId" TEXT,
ADD COLUMN "draftHash" TEXT;
