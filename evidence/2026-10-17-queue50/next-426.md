# #426 Local Acceptance

Issue: https://github.com/TelyAgent/HireOSV2/issues/426

Owner confirmed initial binding scope and Estimate 5; created through issue-submit after execution contract validation. Original #283 Estimate 8 and #284 remaining Estimate 2 preserved and recorded in their GitHub bodies. #283/#284 remain open and unimplemented for their remaining scopes.

## Implemented

- Additive InterviewerAccountBinding table: immutable initial accountId, boundBy and boundAt per directory entry. Existing directory/round records unchanged and no guessed historical bindings.
- Existing admin role required on binding list/write endpoints. Membership validation uses the Identity internal token and exact workspace/user IDs, rejecting inactive membership/account, mismatched results and unavailable/malformed upstream responses.
- Same-target replay returns the original record; conflicting targets serialize on the directory row and cannot overwrite the winner. No unbind/rebind endpoint or invitation side effect.
- Existing Members settings now contains explicit selection, confirmation/cancellation, error recovery preserving input, read-only binding audit and refresh. Invited/disabled accounts excluded from the selector; server validation remains authoritative.
- API/deployment/rollback documentation: `docs/operations/interviewer-account-binding.md`.

## Verification

Final command: `node evidence/2026-10-17-queue50/verify-426.cjs`, exit 0; all 12 checks exit 0 in `426-results.json` and associated logs.

- Identity build/lint/typecheck/test: 36 tests pass.
- Interview backend build/lint/typecheck/test: 70 tests pass.
- Interview frontend build/typecheck/test: 15 tests pass. No frontend lint script is registered.
- Dedicated browser test passes: valid member selection, invalid options excluded, cancel without writes, upstream failure with input retained, retry, read-only audit, reload, non-admin visibility, desktop and 390px layout.
- Screenshots inspected: `426-binding-desktop.png`, `426-binding-narrow.png`, `426-binding-selection.png`. Narrow checks scope the binding panel with navigation collapsed, not the entire existing settings layout.
- Isolated Postgres tests cover the actual Identity membership query and Interview binding transactions. Interview's HTTP client test uses a synthetic membership server; the browser uses synthetic API responses. These are not claims of a real-account end-to-end binding.
- An initial Identity test used a nonexistent membership id; corrected to the existing compound key and rerun successfully. Browser locator failures were corrected with an explicit binding button accessible label and the existing Ant two-character spacing in Cancel. Final checks pass.

## Local Runtime

- Guarded local migration deployment applied `20261018001000_interviewer_account_binding`; Prisma client regenerated.
- Initial local binding endpoint returned 404 because the running process had not loaded the route. Restarted only Identity and Interview backends with the repository dev script after verification.
- Gateway GET `/interview/api/interviewers/account-bindings`: 200 after restart.
- Gateway GET `/interview/api/tasks`: 200.
- Actual local Identity internal membership verification for a synthetic nonexistent user/workspace: 200, `{ "active": false }`; no accounts/bindings written for this check.
- `git diff --check`: exit 0.

## Reviewable Result Draft

[AI-RESULT] #426 initial explicit interviewer/account binding is locally implemented and verified as above. No PR, commit, push, merge, issue closure or production deployment performed. The Scorecard submission/revision functionality in #283 and status integration in #284 are not completed by this change. Formal result comment remains a local draft for the authorized publishing workflow.
