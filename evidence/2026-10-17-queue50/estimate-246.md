# #246 Scope Decision and Estimate

Date: 2026-10-17. Branch: `codex/issue-fixes`. Reviewable draft, not yet published to GitHub. No implementation or test completion claimed.

## Confirmed Decision

[HUMAN-DECISION] Owner approved treating multiple screening reports within one project as duplicates needing resolution. Resolve explicitly selects the current report; other reports remain accessible as superseded. New attachments do not automatically replace an existing current report. Historical multiple reports require human selection rather than a guess based on upload time. Existing scores and published evaluation packages are not recalculated.

## Estimate

Estimate: 5

Status: Owner confirmed 5 points on 2026-10-17; full approved Issue body was validated and updated before implementation.

Evidence reviewed: #246 body and all comments (none), I02 PRD FR-2/BR-3/AC-3 and User_Cases UC-I02-05; Prisma TaskMaterial; TasksService attach/get/packageCurrent/packageEvidence; ScreeningHandoffService; ProjectOverviewPage. TaskMaterial currently has only taskId/materialId/kind. Attachment upsert is idempotent but has no current-selection or resolution history. Current package evidence is derived from capability scores, not attached screening report content.

## Work and Verification

- AC-1: persist selection/resolution state with compatible migration; detect unresolved multiple screening reports on read and after attachments. Preserve legacy files without inventing historical selection or audit timestamps.
- AC-2: Overview selection/confirmation and current/superseded/unresolved labels; retained report content access. Transactional current-pointer update with actor/time/history. Preserve scores and frozen package records.
- AC-3: same operation replay makes no extra transition; stale selection or membership changes produce an explicit conflict instead of overwriting a concurrent choice. Serialize attachment and resolution updates for the same project. Isolated database tests for migration, replay, concurrent choices/attachments, workspace boundaries and unchanged historical data; browser tests for selection, cancellation, failure/input retention, reload and retained old report access.
- Document API and migration/rollback. Reuse existing material storage and workspace checks; no new permissions, external service, parsing algorithm, Triage or general I13 version platform.

Scale rationale: schema migration, a transactional write contract and frontend interaction exceed a 3-point read-only list. A single report type and existing storage/test infrastructure keep this below an 8-point generalized versioning platform. Starting scale used; no formally accepted historical analogue asserted. No time-to-points conversion.

Next: confirm 5 points, update full Issue body with the decision/AC/Estimate, validate submission/execution contracts, then implement and locally test on the existing branch without a PR. #212 and #319 remain deferred.
