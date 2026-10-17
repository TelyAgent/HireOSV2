# #246 Local Acceptance

Owner approved scope and Estimate 5. Full body `issue-246.md` passed execution/submission contracts and was updated on GitHub before implementation. Branch `codex/issue-fixes`; no PR, commit, push, merge or issue closure.

## Changes

- Added task screening revision/current pointer and ScreeningResolution history. Legacy multi-report sets remain unresolved; no fabricated history. A single report is current, and later attachments do not replace it.
- Read endpoint uses a repeatable-read snapshot. Resolve and screening attachment serialize on the same task row; duplicate attachment does not advance revision. Exact same actor/request replay returns the original revision, while competing choices or changed membership reject stale input.
- Resolve records actor/time/selected report/member set; earlier reports remain readable as superseded. New members remain unresolved, leaving the current pointer unchanged.
- Overview shows selection, confirmation/cancel, conflict with retained choice and explicit reload, history and extracted report text. Missing readable text is explicit; this is not a binary-file preview service.
- No score recomputation or published-package changes; no general I13, Triage or role changes.

## Verification

- Prisma client generated; migration `20261017235000_screening_resolution` applied only after checking host `127.0.0.1`, port `55432`, database `hireos_interview`. Deployment completed, 32 migrations present. Migration adds columns/table without rewriting legacy links. Existing-data behavior is tested with legacy-style unselected links, not a production-data migration rehearsal.
- `node evidence/2026-10-17-queue50/verify-251.cjs`: all 8 checks exit 0; Interview backend 68 tests, frontend 15 tests, configured builds/lint/typechecks and existing provenance browser regression. Logs/results retained under `251-*`.
- `node --test test/screening-resolution.test.cjs`: exit 0, rerun after adding actual CardScore and EvaluationPackageVersion immutability assertions. Disposable PostgreSQL schema covers legacy multi-report ambiguity, selected/current/superseded content, concurrent replay, competing actors, attachment race, stale membership, invalid report, workspace isolation, duplicate attachment and unchanged score/package records.
- `env NODE_PATH=/Users/qmk/work/HireOS/hireos-screening/hireos-screening-front/node_modules node test/screening-resolution.browser.cjs`: exit 0. Real Overview with synthetic API covers cancel/no writes, selection, injected 409/input retention, reload/retry, persisted read-back, history, retained old content, new attachment and 390px panel with navigation collapsed. `246-resolution.png` inspected. Not claimed as real-backend browser E2E.
- Same browser environment `node test/activity.browser.cjs`: exit 0, #243 regression including stale response after project switch.
- Local GET `/interview/api/tasks` via port 8080: HTTP 200 after migration. `git diff --check`: exit 0.

## Reviewable Result Draft

[AI-RESULT] #246 approved scope implemented and locally verified as above. Superseded report content is retained and can be read; previous scores and stored packages remain unchanged. No production acceptance or closure claimed. API/deployment/rollback documented in I02 PRD section 12. #247 type-selection boundary awaits Owner confirmation; #212/#319 remain deferred.
