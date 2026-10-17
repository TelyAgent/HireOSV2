# #247 Local Acceptance

Owner confirmed the limited one-way classification scope and Estimate 5. `issue-247.md` passed execution/submission validation and was updated on GitHub before implementation. Work remains on `codex/issue-fixes`; no PR, commit, push, merge or closure.

## Implementation

Only project-linked `other` attachments can become `screening` or `assessment`. Type and nullable actor/time audit fields are written atomically. Same actor/target replay retains the original record; different target/actor after classification conflicts. Foreign project/workspace and illegal types are rejected.

Screening classification uses the same task row lock as #246 attachment/Resolve, increments screening membership revision and preserves the prior current report. Unassigned attachments have an independent Overview section and do not appear in classified material rows. Success reloads both task categories and report state; failures preserve the selected type. Classified rows show actor/time. Controls have visible borders/theme coloring and wrap on narrow viewports.

Existing score/debrief/package evidence is derived from score and transcript references rather than unassigned attachments. No new evidence generator, parsing, file-content change, role model, reversal or general I13 workflow was added.

## Verification

- Generated Prisma client and applied `20261017235500_material_triage` only to guarded local `127.0.0.1:55432/hireos_interview`; 33 migrations present. No historical audit backfill. API/deployment/rollback documented in I02 PRD section 13.
- `node --test test/screening-resolution.test.cjs`: exit 0. Extended isolated PostgreSQL test covers both triage targets, concurrent replay, different actor/type conflicts, invalid type, missing/foreign links, injected audit-write rollback, stale Resolve, actual concurrent triage/Resolve and unchanged Material/CardScore/EvaluationPackageVersion rows. The combined test retains its #246 title; assertions now also cover #247.
- `node evidence/2026-10-17-queue50/verify-251.cjs`: affected Interview full checks (backend build/lint/typecheck/test; frontend build/typecheck/test; original provenance browser) recorded under `251-*`. Backend 68 tests, frontend 15 tests. No frontend lint script is configured.
- Browser command prefix: `env NODE_PATH=/Users/qmk/work/HireOS/hireos-screening/hireos-screening-front/node_modules node`, working directory Interview frontend. `test/material-triage.browser.cjs` covers unassigned exclusion, exactly two target options, cancellation/no writes, injected conflict/selection retention, successful category and report refresh, actor audit, reload and narrow form layout. Synthetic API, not real-server browser E2E.
- `test/screening-resolution.browser.cjs`: exit 0, #246 selection/history/old content regression. `test/task-entry-materials.browser.cjs`: exit 0, original task entry/material naming regression.
- `247-triage-selection.png` records the narrow form; `247-triage.png` records the empty queue after classification. Existing browser font blocking remains; only the new form/panel layout is accepted, not the whole shell mobile layout.
- Local GET `/interview/api/tasks` through 8080 returned 200 after migration; `git diff --check` passed.

## Reviewable Result Draft

[AI-RESULT] #247 approved scope implemented and locally checked. Unassigned files remain separate until explicit one-way classification; audit and #246 membership changes commit together. No production acceptance or closure claimed. #253 format/activity boundary awaits Owner confirmation; #212/#319 remain deferred.
