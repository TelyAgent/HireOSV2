# #260 Schedule interviewer assignment

Branch: codex/issue-fixes. Owner confirmed the Schedule fill-only scope and 3 points on 2026-10-17. Full issue and all comments were re-read; approved scope/Estimate/AI Ready=Yes were backfilled through issue-submit after submission/execution validation. First GitHub read timed out during TLS; retry succeeded. No PR, commit, push, merge, closure, invitation or production write.

## Changes and acceptance

- AC-1: Schedule offers the existing workspace interviewer directory only when the round has no interviewer. Selection is required to save; loading, empty directory and failed-directory retry are explicit. Assigned interviewers remain read-only. Failed saves retain form input. Confirmed plan content is untouched.
- AC-2: Optional interviewerId on the scheduling API is validated against the same workspace. Existing assignments cannot be replaced; completed rounds cannot gain an assignment. The update predicate combines expected version, original assignment and incomplete state, preventing a concurrent assignment or completion from being overwritten. Assignment and schedule are one database update. No new schema or migration.
- AC-3: Temporary PostgreSQL tests cover missing/foreign interviewers, foreign workspace, two concurrent assignments (one succeeds), attempted replacement, completed-round rejection and unchanged plan fields. Real HTTP tests verify routing, accepted assignment and serialized interviewer. Browser tests verify legacy invalid status, directory failure/retry, disabled save, assignment, failed-save input retention, successful save, reload and rescheduling without an assignment payload.

## Verification

Command: `EVIDENCE_PREFIX=260 node evidence/2026-10-17-queue50/verify-335-296.cjs`.

Results: `260-results.json` and `260-*.log`. Full run passed all 11 commands: backend build/lint/typecheck and 64 tests (zero skipped); frontend build/typecheck and 15 tests; question-decision, rubric-evidence, score-reason and schedule-interviewer browser suites. Frontend has no lint script. Screenshot-only refinement reruns the same verifier, with final results in the same files. `git diff --check` passed.

Screenshots: schedule-interviewer-picker.png and schedule-assigned.png. Browser APIs use synthetic data; database tests use disposable schemas. Not proof of production deployment or real invitation delivery. Existing external-font icon rendering is excluded from this focused UI acceptance.

## Compatibility and rollback

Existing callers with an assigned interviewer need not send interviewerId. New frontend/API versions should deploy together, since an old API rejects the new strict-schema field. No data migration is necessary; reverting application code retains saved interviewer assignments. #111's broader wizard and role/notification scope remain separate. #319 stays deferred.

[AI-RESULT] Draft for the authorized publishing workflow: #260's confirmed fill-only scope is implemented and locally verified with the evidence above. No new formal comment was posted. Production acceptance and issue closure are not claimed.
