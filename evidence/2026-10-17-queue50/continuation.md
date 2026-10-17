# Continuation - 2026-10-17

Same branch `codex/issue-fixes`; no PR, push, merge, commit or issue closure. Resumed interrupted verifier: all 23 original configured checks passed (`verification-results.json`). Re-read #250, #325 and #87 including all GitHub comments before continuing. No deeper AGENTS files found in these application trees. GitNexus tools were unavailable; execution paths were traced directly in source.

## Changes

- #250: Draft Rubric now has generated STAR previews, using the existing Brief schema, citation verification and worker. `GET/POST jobs/:id/rubric-questions` scopes by workspace and latest Rubric content hash, deduplicates concurrent generation, validates output citations, and supports retry after invalid output. Draft questions never materialize formal InterviewQuestion rows; ordinary Brief still requires a confirmed Rubric. Card edits invalidate previews. With and without a resume, STAR derives only from capability requirements, never fabricated candidate experience.
- #250: Brief loading now scopes async responses and polling by job, endpoint and preview version; stale responses cannot replace the active state. UI labels draft questions as unconfirmed and shows loading/error separately.
- #325: Overview now explicitly displays each Required L alongside its score/status. Browser test compares L3 and L4 requirements in Overview and Debrief, then checks historical unknown.
- #399: Extended Written browser assertions to normal Passed and unmet/rejected combinations, in addition to unmet/Passed override and historical unknown. All use explicit outcomes, not a numeric cutoff.
- #87: Optional Level's Add action now focuses the Level field instead of silently calling a section-only helper. Four new rendered AnalysisPanel tests cover optional suggestions, one true missing field, Weak conflicts and blockers, including the click action. Initial grouped-list fixtures exposed a real compatibility bug: multiple legacy bullets were counted as one block. Fixed counting to support both grouped ul and individual li, restored grouped fixtures, and added short/overlong/blank-item regression coverage. Node test execution uses the existing WebStorage workaround.

## Verification

`continuation-results.json` and `continuation-*-*.log` record configured checks for the three affected projects, plus their existing unit scripts. The original six-project run is not replaced. Interview backend targeted full suite passed 54 tests, zero skipped, including new database/API preview assertions. JD new component suite passed 4 tests. Browser fixture tests cover confirmed and draft Rubric, each with/without a resume; screenshots include `interview-draft-star.png` and `interview-overview-levels.png`.

Final rerun after all continuation changes: all 11 configured checks exited 0. JD frontend 124 tests passed; Interview backend 55 tests passed with zero skips; Interview frontend 15 tests passed with zero skips. Both `continuation-rubric-browser.log` and `continuation-written-browser.log` record exit 0. `git diff --check` passed. These final totals supersede the earlier targeted counts, not the original six-project evidence.

Backend tests use temporary PostgreSQL schemas and synthetic AI results. Browser tests mock APIs. Neither is a claim of real-model output quality, production deployment or active-database migration. #93 remains blocked by real approval #91. Other original queue blockers are not silently marked fixed. Original estimates are retained.

Additional #250 adapter tests call the actual AiService against a local fake-model HTTP server: both registered generation types accept exact citations and reject invented citations. This verifies transport/schema/adapter wiring, not live model quality. `continuation-intake-final.log` has 22 passed, zero skipped. Final reruns include these cases in the full backend suite.

## API / Rollback

[HUMAN-DECISION] #319: Owner explicitly deferred implementation until the real Offer interface is defined; do not implement the proposed mock-delivery scope. Once resumed, review clearance requires both HR and HM to reconfirm the current basis, creating a new package version; old versions remain read-only and withdrawn evidence is not treated as valid. This decision is recorded here as a draft for the authorized GitHub publishing workflow, not a posted comment. #319 remains open and deferred.

The new preview routes are additive and reuse ParseJob storage; no additional migration is needed for previews. Old workers do not recognize `rubric_questions`; roll out compatible API/worker versions together or disable preview generation during rollback. Keep existing confirmed Brief endpoints unchanged. Previously added Written and per-card-level migrations still require coordinated rollout as recorded in `six-issue-followup.md`.

## Result Comment Draft

[AI-RESULT] #250 draft STAR preview, #325 cross-page level display and #87 optional-field action are implemented locally with automated evidence above. No deployed acceptance or real model validation is claimed. Publish through the authorized GitHub workflow; this file is not a posted comment.
