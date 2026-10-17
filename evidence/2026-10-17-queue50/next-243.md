# #243 Local Acceptance

Owner confirmed scope and Estimate 3 on 2026-10-17. Full body in `issue-243.md` passed execution/submission validation and was published to GitHub. Branch remains `codex/issue-fixes`; no PR, push, merge or closure.

## Changes

Read-only `GET /api/tasks/:id/activity` reads existing Revision records within the current workspace, newest first with deterministic ID tie-break, capped at 20. Returns only ID, actor ID, timestamp and known event category; arbitrary payload and internal reasons are excluded. Unknown types remain unknown.

Overview displays recorded recent activity, loading, empty and local error/retry states. Project identity and effect cleanup prevent old responses from populating another project. Existing Overview grid minimum now fits its container. No migration, new event producer or complete I13 history claimed.

## Verification

- `npm run build` then `node --test test/activity.test.cjs` in Interview backend: exit 0, isolated PostgreSQL test covers empty/read, stable latest-20, cross-workspace/missing-task 404, payload exclusion and no extra writes.
- `node evidence/2026-10-17-queue50/verify-251.cjs`: rerun for affected Interview regression; backend 67 tests and frontend 15 tests, configured build/lint/typecheck plus existing provenance browser. Results/logs in `251-results.json` and accompanying files.
- `env NODE_PATH=/Users/qmk/work/HireOS/hireos-screening/hireos-screening-front/node_modules node test/activity.browser.cjs` in Interview frontend: exit 0. Actual Overview with synthetic API covers populated/empty, failure/retry, loading, late response after in-app project switch, no writes, narrow panel bounds. Initial missing debrief fixture was corrected, not waived.
- `243-activity.png` inspected: 390px viewport with existing navigation collapsed; activity text fits. `243-activity-desktop.png` records desktop panel. This is scoped panel acceptance, not certification of the entire shell on mobile. Existing test font blocking remains.
- `git diff --check`: exit 0.

## Reviewable Result Draft

[AI-RESULT] #243 approved read-only scope implemented and locally tested. Existing Revision coverage is partial by design; missing events are not reconstructed. No production acceptance or issue closure claimed. #212 waits for the real notification channel; #319 remains deferred. #246 duplicate-material policy awaits Owner confirmation before estimation/implementation.
