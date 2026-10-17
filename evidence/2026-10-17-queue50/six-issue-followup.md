# Six-Issue Follow-up - 2026-10-17

> Continued after interruption: all original 23 checks completed with exit 0. The draft STAR gap described below has since been implemented as isolated preview generation; see [continuation.md](continuation.md) for the newer scope and checks. Earlier results are retained as historical evidence.

Branch: `codex/issue-fixes`. No PR, commit, push, merge or issue closure.

## Confirmed Scope and GitHub

Owner confirmed #93=5, #87=2, #397=5, #399=5, #325=8, #250=5. #397/#399 share implementation and are not additive effort. Full issue bodies were validated and submitted through `issue-submit.cjs`. Saved `issue-N.md` files contain the confirmed scope and human decisions. #93 remains AI Ready No because #91 approval is not implemented. The other five have execution-ready bodies. #250 became Yes after the local required-level pipeline passed; its initial backend patch preceded that update, so this is not evidence that every edit was gated before it began.

## Implemented and Remaining

| Issue | Local implementation | Remaining / limitations |
| --- | --- | --- |
| #87 | Ten required fields, optional Level, nonblocking Suggestions, retained conflicting-Level Weak checks | No production acceptance; #91 is not implemented by this change |
| #93 | Shared completeness correction only | Real backend approval #91; not fully fixed |
| #397 / #399 | Explicit human-confirmed met/not_met release outcome; Passed reason required for unmet/unknown; authenticated actor/time and source snapshot; atomic closure; historical unknown and audit display | Production migration/deployment not performed; historical records intentionally unchanged |
| #325 | JD structured per-requirement level validation, authoritative generation snapshot, per-card persisted level/source ID, version copy and per-card Debrief/Overview comparison | No new JD level-entry UI; historical missing values remain unknown; live AI and deployed integrations not accepted |
| #250 | Candidate-scoped cited Claims in Rubric, material/segment provenance, missing/error/empty states, concurrent generation deduplication, invalid-output retry, existing confirmed-Rubric STAR reuse | Draft STAR generation not supported; full issue remains open; real model generation not exercised |

## Verification Evidence

`verification-results.json` records the exact commands, exit codes and separate logs for six affected applications, using the repository CI registry. JD frontend Node tests disable experimental WebStorage because the current Node runtime otherwise supplies an incompatible localStorage. Browser fixtures use mocked APIs, not a real end-to-end deployment. Backend suites exercise migrations, transactions and APIs in temporary PostgreSQL schemas, not the active development database.

Browser commands (from the corresponding frontend directory):

```sh
WRITTEN_TEST_URL=http://127.0.0.1:5208/written/ NODE_PATH=/Users/qmk/work/HireOS/hireos-screening/hireos-screening-front/node_modules node test/release-scope.browser.cjs
NODE_PATH=/Users/qmk/work/HireOS/hireos-screening/hireos-screening-front/node_modules node test/rubric-evidence.browser.cjs
```

Screenshots: `written-close-audit.png`, `interview-rubric-evidence.png`, `interview-required-levels.png`. The browser harness may block external icon fonts; do not classify those fixture-only missing icons as a newly reproduced application defect.

Supplementary captured logs: `jd-required-level-db.log` (9 passed, zero skipped), `written-release-browser.log` and `interview-rubric-browser.log` (both exit 0). Execution-mode contracts for #87/#397/#399/#325/#250 were rechecked after backfill and all exited 0. `git diff --check` exited 0.

### Acceptance Evidence Map

- #325 AC-1/2/3: `required-levels.test.cjs`, Interview `intake.test.cjs`, JD `intake.test.cjs`, and `rubric-evidence.browser.cjs` cover the persisted source snapshot, different L3/L4 thresholds and unknown historical values. Actual model output and production migration remain outside this acceptance.
- #250 AC-1: required level and source IDs appear on the same Rubric cards. AC-2: real API/database tests cover candidate/workspace isolation, citation rejection, no-resume and duplicate generation; browser tests distinguish valid Claim, empty and missing resume. AC-3: confirmed-Rubric STAR displays through the existing Brief; draft STAR is not complete.
- #397/#399: `release-approvals.test.cjs` rejects missing/invalid structured outcomes; `case-concurrency.test.cjs` covers required reasons, authenticated actor/time, unchanged published data, repeated closure, workspace isolation and atomic rollback; browser test covers historical unknown and visible override audit.
- #87: `suggestion-gate.test.ts` covers ten required fields, optional Level, Suggestions and retained Weak/blockers; `publish-gate.test.cjs` covers saved-analysis gating and nonblocking suggestions. #93 is explicitly incomplete because real approval #91 is absent.

## Rollout and Rollback

- Written migration `20261017113000_close_decision` adds nullable JSONB audit data. New release requests require assessmentOutcome; deploy compatible frontend/backend together. Do not infer or backfill historical outcomes.
- Interview migration `20261017114000_required_levels` adds structured JD requirements and nullable card level/source fields. Generate Prisma clients after migrations. Existing missing levels are unknown.
- Migrations were tested only in disposable schemas, not applied to active or production data. Do not point the new backend at an unmigrated database.
- Roll back compatible application versions together while retaining additive database columns and captured audit data; do not destructively drop audit data as part of rollback.
- Product addenda are recorded in W09, W11, I03 and I09. API changes are additive except required outcome on new Written releases and nullable legacy aggregate Debrief bar.

## Reviewable Result Comment

[AI-RESULT] Local changes and remaining scope are listed above. Test evidence is attached in this directory; no deployment or all-50 completion is claimed. Partial issues (#93, #250 and unverified integration scope) must remain open. This is a draft for the authorized publishing workflow, not a claim that a GitHub comment has been posted.
