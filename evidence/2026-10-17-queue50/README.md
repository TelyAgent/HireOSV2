# Queue 50 Local Work

> #260 已确认 Schedule 补填范围与 3 点，后续实现和本地验收见 [next-260.md](next-260.md)。

> 最新续修：#335/#296/#287 的已确认范围、GitHub 回填和本地实现/验证见 [next-335-296-287.md](next-335-296-287.md)。下方原始队列中的相关未决描述为历史快照。

> 后续更新：下列原始快照与阻塞描述保留作历史记录。六项 Estimate 已获确认并回填 GitHub；本轮实现、最新验证和仍未完成的范围见 [six-issue-followup.md](six-issue-followup.md)，不再以本页旧的 Estimate 缺失描述作为当前状态。

Branch: `codex/issue-fixes`, based on `517a5b6`. No PR, push, merge, production data changes or issue closure in this run.

Source snapshot: `/var/folders/8w/t91s3d3s42b9_pmrjc6v1tgr0000gp/T/check-issues-502/TelyAgent/HireOSV2/2026-10-17T10-29-12-596Z-queue50/snapshot.json` (163 open issues and all comments).
Contract results: `/tmp/hireos-queue-contracts-gIZYvZ/checks.json`. Only #319 passes execution validation; other records still have AI Ready / Estimate gaps. These checks are not represented as passed or owner-approved. User requested local work including No items; unresolved behavioral policies are not invented. Checks were collected after the initial decision guard edits.

## Implemented Scope

| Issue | Local change | Remaining before full closure |
| --- | --- | --- |
| #216 | Serializable decision transaction; conflicting actor/content gets 409 with existing decision; exact retry explicitly marked replay; conflict UI preserves input | Expected-version precondition and approved same-content retry policy |
| #215 | Downstream advancement requires a completed current evaluation; missing/stale/running evaluation produces no decision/outbox/audit write | Rules for record-only Hold/Reject and approved use of old evidence |
| #398 | Release editor resets feedback/approval state on case, invitation or finalized evaluation change; rejects mismatched result/case | Production record root cause, relevance policy, historical correction/notification policy |
| #83 | Text/link imports reject changed prose/list fields before persisting; removed automatic fill after import | Full omission/structured-field preservation, suggestion workflow and complete imported-format coverage |
| #366 | Removed fixed fake parse success; explicitly unavailable, no upload or write | Real ZIP service, security/classification/FileVersion contract and confirmation workflow |
| #189 | Explanations for all four signal states, bilingual labels, keyboard disclosure, scoped narrow reflow; PRD/UC/design notes | Local acceptance only; no production deployment or issue closure |
| #303 | Nine unambiguous existing statuses route to their specified screen, including in-progress -> Live; existing stage guards retained | Resolve remaining status targets and all 13-state acceptance/permission cases |
| #362 | Text submissions show actual submitted time, candidate/round/case/invitation IDs; receipt/processing values absent rather than invented | Authoritative receipt/processing timestamps and task binding API; file submissions |
| #242 | Individual real material filenames, IDs and read states rather than category-only summaries; source/version explicitly unrecorded | I13 authoritative source/version, duplicate/triage metadata |
| #198 | Existing refresh/Back code retested with isolated 25-row fixture; fixed ambiguous test locator | No new application logic needed; local browser acceptance passed |
| #84 | Draft explicitly identifies link/text source; link is actionable; reopening uses recorded import metadata, new pasted text records its type | Full created-job provenance acceptance and multiple-import/current-source policy; existing link persistence tests pass |
| #410 | Primary metrics distinguish loading, real zero, unavailable and retry; removed loaded-page fallback; absent snapshot time stated explicitly | More statistics, independent per-metric failure, stale/as-of API and identity-switch acceptance |
| #92 | Existing labels from commit 081683b reverified, not implemented again | Approval/version/next-owner scope still depends on #91 |

## Local Verification

- Screening backend: lint, typecheck and `npm test` passed, 206 tests, 0 skipped. New `test/decision-record-db.test.cjs` uses temporary PostgreSQL schemas, runs five actual concurrent races, checks single decision/outbox/audit/task side effects, missing/stale/running evaluations and workspace isolation. Initial fixture used a nonexistent Job field; corrected and rerun successfully.
- JD backend: lint, typecheck and `npm test` passed, 143 tests, 0 skipped. New `test/import-verbatim.test.cjs` covers altered text, negation, translation, invented requirements, accepted source and idempotent replay.
- JD frontend: final build/lint/typecheck passed. Default Node 24 test run failed on experimental global localStorage. Final `NODE_OPTIONS=--no-experimental-webstorage npm test` passed 115 tests. Added #83 UI test initially had an invalid response fixture; corrected persisted messages. #84 source UI/reopen tests pass. #92 browser test passed real workspace labels at 100%/200% CSS zoom. Existing test stderr includes a NaN-height warning; no failed tests.
- Screening frontend: build/lint/typecheck passed; 59 unit tests passed. `decision-conflict.browser.cjs` passed. `recommendation-signal.browser.cjs` passed four states, keyboard and English/Chinese 683px logical viewport reflow (desktop 200% zoom equivalent width, not an OS-level zoom test).
- Written frontend: final build/lint/typecheck passed; 14 unit tests passed. `submission-meta.browser.cjs` passed ZIP no-fake-success/no-writes and text metadata/no-fabricated-time checks. Browser harness initially used incorrect route and stale Vite module identities; fixed and restarted the local dev server. Release-scope final rerun passed after waiting for React's committed update. `task-metrics.browser.cjs` passed controlled delay, true zero, null due count, HTTP 500, and retry to a nonzero aggregate with zero local rows. Removed one introduced unused-import lint warning and reran successfully.
- Interview frontend: final build/typecheck and 15 unit tests passed after material changes; no lint script is configured. `task-entry-materials.browser.cjs` passed actual in-progress row navigation and material detail/missing states.
- JD backend after adding pasted-text provenance: build/lint/typecheck plus `node --test test/import-verbatim.test.cjs test/link-source.test.cjs` passed 7 tests. Full 143-test suite passed before this final metadata-only change.
- `SYNTHETIC=1 EXE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/workspace-flow.cjs http://127.0.0.1:5199/screening/jobs/j198/screening` passed: refresh retains filters and resets scroll to 0; Back restores position; empty filters and comparison selection work. Initial invocation omitted `/screening`; then duplicate Clear filters locator was scoped to table.
- Vite reports existing large-bundle warnings; not treated as failed builds.

Browser APIs use synthetic fixtures, not production candidates. Browser tests are not proof of backend integration, except the separately identified real PostgreSQL tests. No tests not run are claimed passed.

## Remaining Queue

These entries retain the pre-existing explicit prerequisites from the issue/comment snapshot. No claim that implementation is complete or that all code paths were investigated in this run.

| Priority/order | Issue | Required next step / unresolved prerequisite |
| --- | --- | --- |
| P1/5 | #325 | User confirmed JD structured fields as the authority for per-card Required L. CapabilityCard has no requiredLevel; end-to-end propagation and L3/L4 comparisons remain unimplemented. Execution contract and Owner estimate confirmation remain prerequisites. |
| P1/6 | #256 | Production deployment/request logs needed to locate original JD-unavailable failure. Local facade inspection alone does not establish production cause. |
| P1/8 | #93 | User confirmed latest PRD: 10 required fields, Level optional. Reconcile stale Issue AC; confirmation, saved revision and approval #91 verification remain. Estimate is missing. |
| P1/9 | #87 | Same confirmed field baseline as #93. Preserve distinction between blocking Weak and nonblocking Suggestions and approval-before-publication flow. Estimate is missing. |
| P1/10 | #319 | Existing needsReview guard remains; withdrawal events, Offer invalidation notification/retry and review-clear contract still needed. |
| P1/11 | #397 | User permits Passed override of an unmet result, requiring reason, actor and time. Persistence, validation and historical unknown display remain; no real decisions rewritten. Estimate TBD / AI Ready No still block execution. |
| P1/12 | #399 | Same confirmed override policy as #397; actor/time/reason API/UI audit acceptance remains separate. Estimate TBD / AI Ready No still block execution. |
| P2/13 | #335 | Persistent skipped-question/review contract and audit semantics. |
| P2/14 | #296 | Decision reason and traceable AI evidence source contracts. |
| P2/15 | #287 | Recommendation reason save/submit timing and Scorecard contract. |
| P2/16 | #260 | Existing missing-interviewer guard is retained; locked-plan assignment edit policy unresolved. |
| P2/17 | #294 | Existing chronology correction still needs production read-only audit. |
| P2/18 | #365 | Immutable question versions, historical migration and release-review policy. |
| P2/19 | #368 | Depends on #365 version/state semantics; existing invitations must remain unchanged. |
| P2/20 | #200 | Batch concurrency/cancellation/unknown-result retry policy. |
| P2/21 | #212 | Actual notification channel/template/receipt/re-send semantics; do not send real declines. |
| P2/22 | #246 | I13 material version/Resolve contract. |
| P2/23 | #247 | I13 triage classification/write contract. |
| P2/24 | #251 | Confirm capability sourceRefs -> accessible evidence mapping. |
| P2/26 | #243 | Authoritative activity query and local failure/empty states. |
| P2/27 | #250 | Required L source confirmed as JD structured fields. Verification-card/Claim/STAR relationships and remaining acceptance are not resolved by that answer. Estimate missing / AI Ready No. |
| P2/28 | #253 | Export format/version and I13 activity registration contract. |
| P2/29 | #284 | Prior label correction retained; independent Scorecard state depends on #283 submission/revision policy. |
| P2/30 | #367 | Prior Unknown correction retained; authoritative exposure records/version and allowed data scope. |
| P2/31 | #379 | Prior Not measured correction retained; coverage denominator and Full/Partial/Missing definitions. |
| P2/33 | #361 | Inbox connection/error/empty status source contract. |
| P2/34 | #396 | Actual result-delivery event/receipt adapter and bounce contract, including #357. |
| P3/35 | #312 | Independent aggregate metric status/query contract. |
| P3/36 | #307 | Prior Unavailable correction retained; #308 global count/time-window/deduplication source. |
| P3/38 | #407 | Shared metric/detail filter contract and matching scope. |
| P3/40 | #302 | Confirm Needs my confirmation status/filter ordering. |
| P3/42 | #197 | Eligibility group order, baseline/snapshot relationship and default columns. |
| P3/43 | #201 | Select-all scope and comparison/batch-decision inputs depend on #197. |
| P3/46 | #72 | Prior title-only fact guard retained; field confirmation/defaults policy remains. |
| P3/47 | #77 | General rare-title identification boundary; verify agreed Chief Tidy Officer fixture separately. |
| P3/49 | #78 | Real next-step task owner/deadline data contract. |
| P3/50 | #376 | Official recovery/re-invitation contact path, without fabricated contact details. |

## Comment Drafts

The Implemented Scope rows are the basis of `[AI-RESULT]` partial-fix comments: copy both completed and remaining columns plus the corresponding actual test result. Do not close partial issues. Unresolved policy rows are `[AI-QUESTION]` / `[AI-BLOCKED]` drafts, not newly published comments. Publishing remains subject to the repository's authorized workflow.

The user answered all three product questions on 2026-10-17: 10 required fields with Level optional (#93/#87); Passed overrides allowed with reason, actor and time (#397/#399); per-card Required L from JD structured fields (#325/#250). Exact answers and reviewable `[HUMAN-DECISION]` comment drafts are in [human-decisions.md](human-decisions.md). These drafts have not been published to GitHub and are not evidence of approved Estimates, passed execution contracts or completed implementation.

All final commands listed above exited 0. `git diff --check` also exited 0. No claims of production acceptance or all-50 completion. Changes remain uncommitted on the requested branch.
