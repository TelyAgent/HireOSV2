# Interview local issue batch (2026-10-17)

Branch: `codex/issue-fixes`. Local implementation and validation only; no PR,
push, merge, or Issue closure. Identity/permissions/roles remain out of scope.

## Implemented

- #221 / #304: both Home views open the task's linked resume material in a
  drawer without navigation. Missing resumes disable the entry. Preview shows
  material name, immutable ID and extracted text; failure has retry. This is
  an extracted-text preview, not a rendering of the original PDF/DOCX.
- #227: empty or whitespace-only JD gets an associated inline required-field
  error before creating any upstream records; editing clears the error.
- #223: explain the existing Draft total as candidate tasks plus jobs without
  candidates, with an action to locate drafts in the JD-grouped view. Existing
  count semantics and task ordering are unchanged.
- #252 regression: preserve first/middle card positions when editing while
  appending newly created cards. The previous order-preserving fix dropped new cards.
- #254: confirmed Rubric shows actor account ID, timestamp and the source JD
  version derived from its parse job, never the current job's JD version.
  Missing historical metadata is explicitly unrecorded. Cloning retains source
  provenance but not confirmation. Job switches suppress another job's response.
- #300: statistics and filters withhold counts until loading succeeds. Loading,
  genuine zero and failure are distinct; retry re-enters loading. No metric
  business calculation changed. Jobs/tasks remain one existing combined request
  boundary, so a failure makes the combined snapshot unavailable.
- #288 is in prior local commit `09de2dc`; see `issue-288-local.md` for its
  separate test evidence and limitations.

## Verification

All following commands exited 0 on this batch:

Backend directory `hireos-interview/job-Interview-backend`:
- `npm run lint`
- `npm run typecheck`
- `npm test` (includes build): 46 passed, 0 failed.
- `npm run build && node --test test/rubric-confirmation.test.cjs`: 1 passed.

Frontend directory `hireos-interview/job-Interview-front`:
- `npm run build` (existing large-chunk warning, not a failure).
- `npm run typecheck`
- `npm test`: 13 passed, 0 failed.
- `NODE_PATH=/Users/qmk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node test/issue-batch.browser.cjs`
  against Vite at `http://127.0.0.1:5197/interview/`: all five groups passed.

Browser uses installed Chrome and controlled API fixtures. It covers both
resume entry layouts, keyboard activation, no navigation, absence, preview
retry, empty/whitespace JD, no create request, corrected input, slow Home
requests, true zero, failure and slow retry, refreshed confirmation versions,
unknown source metadata and draft state. No browser JavaScript errors.
The mixed-draft fixture also checks two candidate tasks plus one JD-only job,
two task rows, and navigation to the unfilled job in the grouped view.
Backend intake tests use the existing isolated local database; the dedicated
Rubric confirmation test exercises the service with database doubles.
These are not production browser or production database verification.

`git diff --check`: exit 0. No schema migration or dependency change required.

## Deferred, Not Claimed Fixed

AI Ready=No alone was not used to skip work. Actual unresolved product/data
questions remain: #220 (weight semantics), #297 (post-handoff changes), #302
(confirmation filtering/sorting), #303 (destination rules), #325 (required-level
source), #331 (exception approval). #294 still needs production audit evidence.
#242/#243 need the I13 source/activity data contract; #284 needs distinct
Scorecard submission metadata for full acceptance. No invented values were added.

Rollback: revert the local batch commits. No deployed data changes to undo.
