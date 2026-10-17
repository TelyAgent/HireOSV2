# Local database and API audit - 2026-10-17

Scope: existing local development databases only, at 127.0.0.1:55432.
Code base: f5fa5dde76874888030a5be174bd24409d1b3cfc.
No database reset, production access, business code change, commit or push.

## Recovery

JD had one unapplied migration: `20261016100000_add_jd_analysis_gate`.
It adds nullable `JobDocument.aiAnalysis` and `aiAnalysisRevision` fields.
Executed `npm run prisma:migrate:deploy` in
`hireos-jd/hireos-jd-backend`; exit 0, migration applied successfully.
Written (one migration) and Interview (five migrations) had already been
recovered immediately before this audit; see the sibling recovery reports.

## Database verification

All six projects in `.github/ci/projects.json` with Prisma enabled were checked.
`npx prisma migrate status` exited 0 for Core Record, JD, Screening, Written,
Interview and Identity. No migrations remain pending.

Read-only `prisma migrate diff` comparing the configured database to the current
schema exited 0 for JD, Screening, Written, Interview and Identity.
Core Record exited 2: only two historical long index names differ from Prisma's
expected names (ApplicationStatusHistory and JobRequirementSnapshot). There
were no missing tables or columns. No unrelated index renaming was performed.
Full command outputs and credential-free local targets are in
`local-services-results.json`. The script's exit code checks migration status
and HTTP results; schema drift is recorded separately and must be reviewed.

## API verification

Executed `node evidence/2026-10-17-queue50/check-local-services.cjs`; final exit 0.
367 GET requests, zero unexpected responses and zero HTTP 500 responses:

| Service | Requests | Results |
| --- | ---: | --- |
| JD | 102 | 65 HTTP 200; 37 DOCUMENT_NOT_FOUND HTTP 404 |
| Screening | 31 | All HTTP 200 |
| Written | 24 | All HTTP 200 |
| Interview | 193 | All HTTP 200 |
| Core Record | 14 | 13 HTTP 200; one expected INVALID_SCHEMA HTTP 422 |
| Identity | 3 | Two HTTP 200; expected AUTH_REQUIRED HTTP 401 |

JD document 404s correspond to unsaved documents and match the service's
explicit error code. Core candidates lookup requires email: the initial audit
omitted it and failed; the corrected audit tests both missing-email validation
and a valid synthetic lookup. Identity authentication was tested without a
session, so 401 is expected. Expected error codes are asserted, not just statuses.

Business services were exercised through localhost:8080, Core Record through
the backend gateway on 8090. Checks use actual list IDs for job/task/application/
case/round details, plus related scores, summaries, decisions and package history.
Core job details were sampled from the first five jobs. Responses containing
candidate content were not saved; evidence contains paths, statuses and codes.

This is an API smoke check, not complete E2E or all-data coverage. No invitation,
decision submission, authentication session or other write flow was exercised.
Build/lint/unit suites were not rerun because application code was unchanged.
