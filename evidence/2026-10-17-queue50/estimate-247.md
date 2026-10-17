# #247 Scope Decision and Estimate

Date: 2026-10-17. Reviewable draft, not published to GitHub. No implementation or verification claimed for #247.

## Confirmed Scope

[HUMAN-DECISION] Owner approved classifying only unassigned task attachments (`other`) into `screening` or `assessment`, preserving actor and time. Screening classification integrates with #246 duplicate report handling. No resume/JD classification, reversal or reassignment of an already classified attachment in this scope. No candidate/job relinking or role expansion.

## Estimate

Estimate: 5

Status: Owner confirmed 5 points on 2026-10-17. Approved body validated and updated on GitHub before implementation.

Evidence: #247 body and all comments (none); I02 PRD FR-3/BR-4/AC-4 and UC-I02-06; TaskMaterial schema; TasksService attach/screeningReports/resolveScreening and evidence reads; ProjectOverviewPage source-material grouping; existing #246 database and browser test infrastructure. The current task-material write path attaches a kind but has no triage operation or audit. #246 already serializes screening membership and selection on the project row.

- AC-1: separate unassigned attachments and their triage status from usable material categories. Verify actual candidate evidence/read paths exclude other; do not infer evidence status from mere attachment presence.
- AC-2: validated one-way classification endpoint and UI selection/confirmation, persisted actor/time and original/target type; compatible migration without invented legacy actor/time. Atomically update classification and screening membership revision when applicable, keeping the prior current report unchanged according to #246.
- AC-3: isolated database tests for both target types, replay, conflicting types/actors, foreign workspace/project/material, transaction rollback, and concurrent Resolve; browser tests for unassigned/category visibility, cancel, failure/input retention, history, refresh and narrow layout. Verify attachment contents, existing scores and stored packages remain unchanged.
- Reuse existing storage, project locking and local test facilities. Update API/PRD and migration/rollback instructions; run configured build/lint/typecheck/tests. No external I13 service or classifier integration.

Scale: a cross-layer transactional state change with migration/audit and #246 membership coordination exceeds a small 3-point standalone UI/API change. Two fixed target types, one-way transitions and existing concurrency infrastructure bound it below an 8-point generalized classification/version platform. Starting scale used, without asserting a formally accepted historical analogue. Points are not derived from implementation time.

Next: confirm 5 points, reconcile and validate the full Issue body, update GitHub, then implement locally on `codex/issue-fixes` without a PR. #212/#319 remain deferred.
