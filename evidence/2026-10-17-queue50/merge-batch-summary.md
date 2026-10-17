# Local Merge Checkpoint

User explicitly requested commit, merge and closure of repaired issues. No PR requested; retain the current local development branch after merging into main. This checkpoint includes the cumulative changes after e6a83fa and that prior local migration-recovery evidence commit.

## Closure Scope

Fully implemented approved scopes: #215, #216, #243, #246, #247, #251, #365, #368, #424, #425, #200 (both child phases), #426. Closure follows successful local checks and remote main publication; individual result comments link the merged evidence.

Keep open with explicit result comments:

- #198: return/refresh behavior repaired and reverified; full dimension/filter-combination AC-3 remains incomplete.
- #253: PDF export/snapshot/generation audit AC-1/2/3 done; full I13 Activity/DownloadAttempt AC-4 incomplete.
- #283: account association prerequisite #426 done; independent submission/revision/count/downstream submitted-only behavior still unimplemented.
- #284: earlier completion-date wording fixed; independent Scorecard state and related browser tests still depend on #283.

#212 and #319 remain deferred, unchanged by this checkpoint.

## Verification

Run `node evidence/2026-10-17-queue50/verify-merge-batch.cjs`. Final exit codes are recorded in `merge-batch-results.json`, with nested exact commands in `426-results.json`, `425-results.json`, `365-results.json`. It runs all registry checks for Identity, Interview, Screening and Written affected projects, plus unit/integration/browser regressions and Screening's isolated real-backend browser E2E. No unexecuted hosted CI, independent QA or production deployment is claimed.

The first aggregate run failed the existing workspace Back-scroll regression; all other groups passed. Investigation reproduced the failure: the departure value was stored but a loading-phase scroll event could overwrite it before restoration. The list now captures the actual position at departure and freezes it until restoration; the browser assertion additionally checks exact departure restoration (including browser scrolling a clicked row into view). This is a regression repair in the new batch workbench acceptance, not a change to the approved refresh policy. The original assertions remain.

The standalone repair verification and final aggregate rerun both passed (exit 0): 38 individual checks, including 502 automated tests (Identity 36, Interview backend 70/frontend 15, Screening backend 217/frontend 59, Written backend 91/frontend 14), plus browser regressions and Screening E2E. All eight aggregate groups passed. Staged whitespace validation passed after marking the uncompressed PDF evidence as binary in a directory-local .gitattributes; PDF bytes were not edited. Earlier evidence files record their implementation-time uncommitted status; GitHub merge result comments supersede that status without rewriting historical evidence.

## Rollout Boundaries

Additive migrations affect Screening batches, Written question versions/deprecations, and Interview report resolution/triage/PDF export/account association. They were applied to guarded local databases; production migration is not performed here. Identity membership endpoint must be deployed before enabling Interview association writes. Decision/version-sensitive frontend and backend need coordinated deployment. Keep immutable historical records on rollback; do not reset databases or fabricate missing history.

Tests use synthetic data and disposable PostgreSQL schemas. Browser fixtures are synthetic except the separately identified Screening batch E2E; PDF rendering was independently inspected. Existing build bundle warnings and font-blocked shell fallbacks are documented, not silently accepted as full production visual QA.
