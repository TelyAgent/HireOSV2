# Interview local batch 2 - 2026-10-17

Branch: `codex/issue-fixes`. No PR, push, merge, remote comments or Issue closure.
Scope excludes identity, role and permission changes. Issue bodies and comments
were re-read before selecting these tasks; this is not a complete Issue audit.

## Changes and AC Evidence

### #324 - cross-round human scores (S2, first)

- AC-1: `GET tasks/:id/debrief` adds `cards[].roundScores`, ordered by round
  sequence. Each entry has round ID/name/sequence, assigned interviewer ID/name,
  score (including null), human note, updatedAt, and optional `aiEvidence` with
  source segment ID and quote. Query is constrained to the workspace, task rounds
  and current confirmed rubric cards. Frontend renders all entries.
- AC-2: no writes, deletion or automatic conflict resolution. Existing headline
  calculation (latest non-null human score) is unchanged. Earlier opinions are
  retained on repeat reads and after browser reload.
- AC-3: service regression covers round 1 score 2, round 2 score 4, round 3
  Unknown, separate rationales/citations, and an unrecorded interviewer.
- Human evidence consists of recorded rationale; existing AI source quotes are
  explicitly labelled as AI-cited, not misrepresented as human annotations.
  Missing citations are shown honestly. This does not implement #286/#330's
  full original-source drilldown or define new disagreement thresholds.

### #314 - Home search (S3, second)

- AC-1: labelled search control filters existing project/candidate data; clear
  restores the original list.
- AC-2: both task and JD-grouped views reuse existing taskMatches/searchQuery.
  No new requests, permissions or expanded data visibility.
- AC-3: browser tests cover candidate/job matches, case/whitespace handling,
  no results, clear, Draft/Published combination and JD-only search.

### #306 - supplementary statistics hierarchy (S3, third)

- AC-1: six supplementary metrics and three trend metrics have separate headings
  and labelled regions, matching I12 FR-3/FR-4. Metric calculations unchanged.
- AC-2: expand control shows total 9 and exposes aria-expanded/aria-controls.
- AC-3: browser tests cover keyboard expand, 6/3 counts, return Home, collapse
  and reload. Initial run exposed a preference race: mount effects wrote default
  values before restoration. Reading existing preferences in the reducer
  initializer fixes this without changing preference keys or isolation rules.
  User/workspace isolation remains out of scope (#310).

## Local Verification

Backend `hireos-interview/job-Interview-backend`:
- `npm run build && node --test test/debrief-rounds.test.cjs test/unknown-scores.test.cjs`: exit 0, 3 passed.
- `npm run lint && npm run typecheck && npm test`: exit 0, 47 passed; test script includes build.

Frontend `hireos-interview/job-Interview-front`:
- `npm run build && npm run typecheck && npm test`: exit 0, 13 passed.
- Existing large-chunk build warning remains; not a failing check.
- Frontend lint is not a configured CI check/script for this project.
- Browser runtime: installed Chrome, local Vite `http://127.0.0.1:5197/interview/`.
- `NODE_PATH=/Users/qmk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node test/debrief-search.browser.cjs`: exit 0, all three groups passed; Debrief checked at widths 1366 and 390.
- Same NODE_PATH with `node test/issue-batch.browser.cjs`: prior batch regression suite, all five groups passed.

Browser tests use synthetic API fixtures; service regression uses DB doubles.
The full existing backend suite also exercises its isolated local database.
No production account/candidate changes or live Zoom verification were made.
No DB migration, package/dependency changes or new product rules. API extension
documented above and in the frontend contract. Existing product ACs unchanged.

## Deferred Findings

These remain open, not claimed fixed: #215/#216 (unresolved stale decision and
retry rules), #326 (weight calculation policy), #298 (confirmation object and
roles), #249 (shared Job vs project rubric version model), #253 (export/Activity
contract), #335 (question-state persistence contract), #342 (history access and
Zoom old-link revocation), #256 (production request-chain evidence unavailable).
#228 needs an authoritative JD version selection contract: current Interview
jdVersion is a local sync counter, not proof of a selected JD Management version.
Do not present it as the source version.

Rollback: revert the local batch commits; no stored business data changed.
