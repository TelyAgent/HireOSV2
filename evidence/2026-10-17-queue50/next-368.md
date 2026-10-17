# #368 Local Acceptance

Branch: `codex/issue-fixes`. Owner confirmed scope and Estimate 5; complete body was validated and updated on GitHub. No PR, push, merge or issue closure.

## Implementation

- Atomic deprecation plus immutable audit (actor, version, timestamp), row-lock serialization and replay for duplicate deprecation. Stale revisions, drafts and foreign workspaces are refused.
- Published questions expose a deprecation confirmation; history survives reload and subsequent publication. Deprecated revisions cannot be restored directly: edit to a new draft, then publish a new version.
- New plan selectors exclude deprecated/draft questions; the API rejects bypass attempts. Existing invitations retain their snapshot.
- Removed the plan selector's hardcoded Approved v1 claim; it shows the actual selected published version.
- Migration `20261017230000_question_deprecations` applied to guarded local written database only; rollback precautions documented in W01 PRD.

## Verification

`node evidence/2026-10-17-queue50/verify-365.cjs` was rerun after #368 extensions: all nine checks exit 0, recorded in `365-results.json`. Backend 91 tests and frontend 14 tests passed, along with both builds/lints/typechecks and the browser test.

Database tests cover concurrent duplicate deprecation, stale revision, workspace isolation, audit failure rollback, direct restore rejection, new-plan gates, edit/republish and unchanged old public invitation content. Browser uses synthetic APIs for detail lifecycle; separately mounts the real plan selector with published/deprecated/draft fixtures and verifies only the published option can be selected. This is not claimed as a full real-server plan browser E2E.

Browser checks cover audit/refresh, edit/republish v3, preserved v2 audit, immutable prior content, failed publication/retry and 390px content bounds. `368-deprecation.png` inspected. Existing shell icon-font fallbacks remain in the font-blocked test harness, not accepted as production font rendering. Initial harness failures (Vite CommonJS import, missing Ant App provider, retry modal locator) were corrected and the whole suite rerun successfully.

`git diff --check` passed. #212 is awaiting notification channel/template decisions; #319 remains deferred.

## Reviewable Result Draft

[AI-RESULT] #368 confirmed scope implemented and locally verified with the evidence above. No real candidate notification, production mutation, PR or closure performed. Formal result publication awaits authorized workflow.
