-- #230: the language a round's interview is held in, for its live transcript. Rounds so far were transcribed in Chinese.
ALTER TABLE "InterviewRound" ADD COLUMN "interviewLanguage" TEXT NOT NULL DEFAULT 'zh';
