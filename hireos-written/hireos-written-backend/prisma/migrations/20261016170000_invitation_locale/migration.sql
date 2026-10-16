-- #229: the language a candidate is written to. Invitations sent before this were all in Chinese.
ALTER TABLE "Invitation" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'zh';
