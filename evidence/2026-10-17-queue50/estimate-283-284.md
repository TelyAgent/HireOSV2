# #283 / #284 scope and estimate

## Confirmed product decisions

- Per-item saves remain draft. Scorecard submission is explicit.
- Only the original submitter can start a revision, with a required reason; revisions require explicit resubmission and preserve previous submissions.
- Submission requires a completed round, explicit score or Unknown and reason for each round capability, plus recommendation and reason. Missing input is not explicit Unknown.
- Downstream readers use the latest submitted version. Revision drafts do not replace it. Existing scores without submission records remain drafts; no invented historical submissions.
- Personal pending count includes completed assigned rounds awaiting first submission or revision resubmission.
- These decisions were confirmed by the Owner in this conversation. Prepared for GitHub recording before implementation; not yet published by this evidence file.

## #283

Estimate: 8

Status: Owner confirmed 8 points in this conversation. Implementation awaits the identity-link decision below.

- AC-1: add persistent draft/submission state, explicit Unknown distinction, migration, API and Review submission validation.
- AC-2: replace Home.tsx hardcoded scorecard count with an identity-scoped query; test first submission, revision reopening, resubmission and concurrent retries.
- AC-3: immutable submitted snapshots, original submitter revision guard, reason/actor/time history, stale draft protection and atomic submit-versus-save handling.
- AC-4: isolated database lifecycle/concurrency/tenant tests and browser draft, submission, retry, revision, history and count tests.
- Integrate submitted snapshots into TasksService.debrief, decisionSegments and packageEvidence without changing aggregation formulas or rewriting existing published packages.
- Update I08/API and migration documentation. Reuse existing Prisma/PostgreSQL, round scoring, recommendation validation and browser fixtures. No new external service or role framework.
- Starting-scale estimate: larger than 5 because persistence, write concurrency and three downstream consumers form one version contract. Bounded to one subsystem with reusable testing facilities; no new approval workflow or AI algorithm.
- Historical drafts may disappear from formal downstream scoring until explicitly submitted, as approved. Existing stored decisions/packages are not automatically regenerated.

## #284 Remaining Work

Estimate: 2

Status: Owner confirmed 2 points for remaining scope in this conversation. No previously confirmed estimate is being replaced. Depends on #283.

- AC-1: retain the existing Interview completed wording and regression.
- AC-2: display round completion separately from draft/submitted/revision-draft status using #283 data, with actual submitter/time rather than completedAt.
- AC-3: test completed-round/draft and submitted states, plus revision display and reload.
- Depends on #283; its migration, submission engine and downstream integration are not counted again.
- More than a text-only 1-point change because distinct persisted states need UI and browser verification; no additional backend model warrants 3 points.

## Inspected Sources

- `hireos-interview/job-Interview-backend/src/intake/rounds.service.ts`: scores/setScore currently have no independent submitted version.
- `hireos-interview/job-Interview-backend/src/intake/tasks.service.ts`: debrief, decisionSegments and packageEvidence read mutable CardScore.
- `hireos-interview/job-Interview-front/src/pages/Home.tsx`: scorecard counter is hardcoded to zero.
- I08 PRD, User Journey and 2026-10-15 test report; GitHub #283/#284 bodies and comments.

No implementation or tests performed for these two scopes by this estimate. Existing unrelated branch changes are preserved.

## Newly Verified Dependency

`prisma/schema.prisma` defines Interviewer as a standalone directory entry with id, workspaceId, name, title and email, explicitly not linked to membership records. InterviewRound.interviewerId references that directory, whereas WorkspaceGuard.Identity.actorId is the authenticated account userId. No reliable account-to-assignee key exists in the inspected model.

The approved personal pending count and assignee submission checks cannot compare these unrelated IDs or infer identity from names/email. An explicit same-workspace account association is proposed for Owner approval; this is a newly discovered dependency, not an implemented permission policy. The confirmed estimates above remain unchanged; any added association workflow needs separate scope assessment. #283/#284 must remain open and must not be represented as implementation-ready until this dependency is resolved.

[AI-QUESTION] draft: Confirm explicit account association for the interviewer directory, or defer #283/#284. Unbound interviewers must not silently become the current user or a workspace-wide count. No GitHub comment has been published by this local draft.

## Owner Resolution and Supplemental Estimate

The Owner approved explicit account association in this conversation: an administrator binds a directory interviewer to an account in the same workspace; no name/email inference and no role-system expansion. This resolves the approach question above. Original #283 (8) and #284 (2) estimates remain confirmed and unchanged.

Supplemental Estimate: 5

Status: Owner confirmed 5 points and authorized creation of the separate dependency Issue #426. Do not sum this into #283's Estimate field.

- Reuse Interview MembersSection and the existing admin role. Add account association storage and an audit record with actor/time; preserve existing unbound directory entries.
- Validate target membership on the server against Identity, including workspace and active membership/account status. Existing public lookup includes former members and is not sufficient for this check. Existing internal controller exposes session introspection only, so add a narrowly scoped authenticated membership check rather than trusting the browser list.
- Provide explicit initial binding with repeat-request idempotency and concurrent conflicting binding rejection. Proposed first scope does not include changing/removing an established association; no change to historical Scorecard actors or assigned round directory IDs.
- Unbound directory entries remain visible and cannot authorize personal submission. Identity lookup failure must not bypass validation.
- Verify admin/non-admin, wrong workspace, disabled/removed membership, missing target, repeated request, conflicting concurrent requests, audit persistence, migration and browser selection/error/reload. No invitation or email side effects.
- Scope includes API/operation documentation and local Interview/Identity regression checks. Larger than 3 because it crosses a service trust boundary and persists auditable bindings; smaller than 8 because existing members UI, roles and account model are reused and reassignment workflow is excluded.

Additional inspected sources: Interview interviewers.controller.ts/service.ts (currently list-only), settings/MembersSection.tsx; Identity internal/internal.controller.ts and users/users.controller.ts/service.ts. Existing member listing is admin-guarded, membership is workspace-scoped in Identity, and account lookup intentionally includes former members.

[AI-QUESTION] draft: confirm supplemental 5 points and a separate dependency Issue for initial explicit account binding (no rebind/unbind in this scope). No new Issue has been created; no binding code or tests have been run.
