# #253 Phase One Decision and Estimate

Date: 2026-10-17. Reviewable draft, not published. No implementation or passed tests claimed for #253.

## Owner Decision

[HUMAN-DECISION] Implement PDF export first, freezing the selected Rubric state/version, capabilities, weights, level anchors, verified provenance and confirmation information. Persist requester/time and generation success/failure records, queryable from Rubric. Full I13 Activity integration remains unfinished; generated does not mean downloaded. Parent #253 remains open after phase one.

## Estimate

Estimate: 5

Status: Owner confirmed 5 points for phase one on 2026-10-17. Full I13 integration is not estimated or counted in this phase. Approved full Issue body validated and updated before implementation.

Evidence: #253 body and all comments (none), I03 PRD export scope and I13 PRD FR-13/AC-9/export object contract; RubricService getRubric/update/confirm and RubricVersion versionNumber/version fields; rubricCardSource; existing package-pdf writer; RubricPage and downloadApi; existing isolated PostgreSQL/browser test facilities.

- AC-1 phase scope: export control for saved draft/confirmed Rubric and clear state, version number and edit revision in the artifact. Do not silently include unsaved edits. Page supplies expected identity/revision so stale requests fail instead of exporting a different version.
- AC-2 phase scope: transactionally capture immutable content with verified source metadata, then render PDF from that capture. Subsequent edits must not change the stored artifact basis. No guessed legacy provenance or confirmation data. Validate Chinese/English and multipage content, headings, weights/anchors and source/confirmation fields.
- AC-3 partial: persist requester, time, source version and generation result/error with a local Rubric history view. Keep server generation separate from browser transfer outcome; failed generation remains queryable. Workspaces cannot query/export others' records. Authorized requests that cannot create a record must fail, not report audit success. Full I13 Activity/DownloadAttempt integration remains explicitly outstanding.
- Add compatible persistence/migration and deployment/rollback notes; reuse PDF writer, source verifier and download helpers. Test database consistency/retry/failure behavior, UI failure/history/reload, binary PDF rendering and local build/lint/typechecks.

Scale: cross-layer export, immutable data capture and persisted failures exceed a 3-point download-button change. Reusing PDF/provenance helpers and deferring generalized I13 integration keep this below an 8-point export platform. Starting scale, not an asserted accepted historical delivery analogue. No external service or new roles in scope.

Next: Owner confirms five points; update the full Issue body with phased AC and remaining I13 work, validate contracts, then implement on `codex/issue-fixes` without a PR. Do not close #253 for phase-one completion or create child issues without authorization.
