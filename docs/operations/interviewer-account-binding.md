# Interviewer Account Binding

Refs #426; prerequisite for #283/#284.

## Contract

- Directory records retain their IDs and round assignments. The additive `20261018001000_interviewer_account_binding` migration creates no historical bindings.
- Interview Settings > Members provides explicit initial binding for administrators. Only active accounts with active membership are eligible; invited, removed and disabled accounts are rejected.
- `GET /interview/api/interviewers/account-bindings` returns directory rows with nullable accountId/boundBy/boundAt metadata to administrators.
- `POST /interview/api/interviewers/:id/account-binding` accepts `{ "accountId": "..." }`. Workspace and actor come from authenticated request identity, not the payload.
- Same-target retries return the existing audit record without changing its actor or timestamp. Another target returns 409 `INTERVIEWER_ALREADY_BOUND`. No unbind/rebind API is included.
- Multiple legacy directory records may refer to the same account; each directory entry has at most one immutable binding. This does not merge directory entries or alter round assignments.
- `POST /internal/memberships/verify` on Identity requires `x-internal-token`, accepts workspaceId/userId and returns active plus exact IDs only for an active membership and account. It exposes no names, email or role data. Existing gateway internal-route denial applies.
- Interview uses IDENTITY_INTERNAL_URL and IDENTITY_INTERNAL_TOKEN. Unconfigured, malformed, failed or timed-out checks fail closed with 503 `IDENTITY_UNAVAILABLE`; invalid membership returns 400 `ACCOUNT_NOT_ACTIVE_MEMBER`.
- Binding records prove the explicit association at the time of verification, not perpetual account eligibility. Current authenticated membership remains required for future user actions. A previously stored association may be displayed for a subsequently disabled account; it does not reactivate it.

## Deployment and Rollback

Deploy Identity's membership endpoint before enabling Interview binding writes. Generate the Interview Prisma client and apply the additive migration before starting the updated Interview backend. No Identity database migration is needed. The ordinary directory listing contract remains unchanged.

Rollback application code before removing new data structures; preserve binding audit records rather than deleting them. No account roles, invitations, emails, existing Scorecard data or published packages are modified by this feature.

## Verification

`node evidence/2026-10-17-queue50/verify-426.cjs` runs registry-defined checks plus tests for Identity and Interview, and the dedicated browser fixture. The browser uses synthetic API responses; isolated database tests exercise each backend and Interview's HTTP membership client separately. This is not production deployment evidence.
