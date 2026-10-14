-- Issue #48: assessment rounds. Every invitation is one round; a plan item belongs to the round it
-- was sent in (null = the case's current, still-editable draft round).

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "draftRoundOpen" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "round" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN     "invitationId" TEXT;

-- Backfill (AC-8): number existing invitations per case in send order (normally just round 1)...
UPDATE "Invitation" AS i
SET "round" = r.rn
FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "caseId" ORDER BY "createdAt", "id") AS rn FROM "Invitation") AS r
WHERE i."id" = r."id";

-- ...and attach a case's existing plan items to its first invitation: they were all sent in round 1.
-- Plan items of cases that never sent anything stay in the draft round (invitationId NULL).
UPDATE "PlanItem" AS p
SET "invitationId" = f."id"
FROM (SELECT DISTINCT ON ("caseId") "id", "caseId" FROM "Invitation" ORDER BY "caseId", "createdAt", "id") AS f
WHERE p."caseId" = f."caseId";

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_caseId_round_key" ON "Invitation"("caseId", "round");

-- CreateIndex
CREATE INDEX "PlanItem_invitationId_idx" ON "PlanItem"("invitationId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

