-- A released result is no longer the end of the written test: HR still has to hand the candidate
-- off to Interview or close testing, so the task stays open until a terminal status
-- (handed_off / closed). Reopen tasks the previous migration closed at "released".
UPDATE "Task" t SET "status" = 'open'
FROM "Case" c
WHERE t."caseId" = c."id" AND c."status" NOT IN ('handed_off', 'closed') AND t."status" = 'completed';
