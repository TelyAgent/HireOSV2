# Owner Decisions and Estimate: #212 / #243

Date: 2026-10-17. Branch: `codex/issue-fixes`.
Reviewable GitHub comment drafts below; not yet published. No implementation or tests claimed for either issue.

## #212

[HUMAN-DECISION] Wait until the real notification channel is determined; do not implement a simulated notification workflow. Approved neutral template: “感谢您申请 {岗位名称}。经过评估，我们暂不推进本次申请。感谢您的时间与关注。” Allow editing before confirmation. Do not automatically include scores, ranking or internal comments. This approves the template, not a channel, delivery receipt, resend rule or Estimate.

[AI-BLOCKED] Channel and actual delivery contract remain unresolved. Resume after the real provider, delivery/receipt and duplicate-request behavior are confirmed. Keep the issue open; do not send real declines.

## #243

[HUMAN-DECISION] First display existing real Revision records in Overview, explicitly labeled recorded recent activity. Do not invent missing events, add event-generation rules, or claim complete coverage of creation/Scorecard/I13 events.

Estimate: 3

Status: proposed, awaiting Owner confirmation; not implementation authorization.

Evidence: issue #243 and all comments (none); I02 Project Overview Linking PRD and Test Report I02-UX-004; backend Prisma Revision model and TasksService updateIntake/setDecision revision writers; ProjectOverviewPage; CI projects registry and existing isolated-database/browser test patterns.

- AC-1: add a bounded, newest-first, workspace-scoped read-only Revision endpoint and an Overview activity section showing recorded event, actor ID and time. Map known event kinds; unknown kinds remain explicitly unknown. Do not return arbitrary payloads or internal decision reasons.
- AC-2: separate loading, no recorded activity and fetch-failure states; local retry must not block the rest of Overview.
- AC-3: isolated database tests for existing/empty records, stable ordering, bounds and cross-workspace denial; browser tests for populated/empty/failure/retry, task-switch stale response protection and narrow layout.
- Update I02 documented implementation boundary. Run configured backend build/lint/typecheck/test and frontend build/typecheck plus available tests and browser harness.

Scale: a small cross-layer read-only feature with state/isolation regressions, larger than a 2-point label or isolated endpoint fix; no schema migration, new writes, event stream infrastructure or cross-service integration to justify 5. Starting scale is used, not an asserted formally accepted historical analogue. Existing audit coverage remains partial by Owner-approved scope.

Next: obtain confirmation of 3 points, reconcile complete Issue body/AC/Estimate, validate submission and execution contracts, update GitHub, then implement locally on this branch without a PR.
