# JD local fixes: #85 and #92 (2026-10-17)

Branch: `codex/issue-fixes`. Local changes only; no PR, push, merge, remote
comments or Issue closure. Identity/role/permission rules are unchanged.

## #85 - implemented

- AC-1: the M4 composer explicitly rejects file/FTP URLs, preserves input and
  produces no draft or create call. Both protocols have component tests.
- AC-2: the import service rejects unsupported single URLs before conversation
  access, extraction, AI or writes, including URL-shaped input in the text path.
  Existing minimum-length validation can reject short text first. The extraction
  regression injects DNS/fetch counters and proves zero outbound operations for
  file/FTP URLs. Existing extractor HTTP(S)-only restrictions remain unchanged.
- AC-3: link-import failures expose a `Paste full JD text` action, which focuses
  and clears the composer without deleting the original URL in the conversation.
  Test covers login error, no draft creation, and subsequent full-text submission.
  English and Chinese action/protocol messages are included.

## #92 - partial, keep open

- AC-1: the workspace header explicitly labels `Recruiting status` and
  `JD publication`. A published recruiting state and an unpublished JD no longer
  appear as two unlabeled contradictory badges.
- Publication shows the actual version when available, and Loading while its
  metadata is unavailable; no approval result is invented.
- AC-3: tests cover English and Chinese text, version display and loading.
  Chrome browser check opens the real workspace using synthetic API responses,
  verifies both labels and checks no overlap with Publish at normal and 200%
  CSS zoom. This is CSS reflow testing, not a native browser-menu zoom test.
- AC-2 remains dependent on #91's authoritative approval API/version contract.
  No fabricated pending/approved/version/next-approver information was added.

## Verification

Frontend directory: `hireos-jd/hireos-jd-front`.
- `npm run build && npm run typecheck && npm run lint`: exit 0.
- `NODE_OPTIONS=--no-experimental-webstorage npm test`: exit 0; 22 files,
  111 tests passed. Existing large-chunk build warning remains.
- Initial plain `npm test -- test/link-import-recovery.test.tsx` failed before
  exercising UI: this host's Node native localStorage shadowed jsdom storage.
  Disabling Node experimental webstorage uses jsdom's real test storage; the
  rerun passed all 6 cases. No application workaround was added.
- `NODE_PATH=/Users/qmk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node test/job-status.browser.cjs`:
  exit 0 against local Vite on port 5198. No browser page errors.

Backend directory: `hireos-jd/hireos-jd-backend`.
- `npm run build && node --test test/unsupported-import.test.cjs`: exit 0,
  one test passed, covering both protocols and both API input fields.
- `npm run lint && npm run typecheck && npm test`: exit 0; 140 tests passed,
  zero failed/skipped. `npm test` includes build. Controlled browser rendering
  tests (including login walls, redirects and failed renderers) completed.

Tests use synthetic data, stub services and controlled network fixtures; no
real candidate records or third-party posting was created or published.
No schema migration or dependencies changed. Existing M4 and M7 requirements
were followed; no new business or approval policy introduced.

## Remaining Constraints

Re-read #93/#87 before choosing this batch: same-revision approval submission
and the rest of #91 are not completed by these UI changes. Also left unchanged:
#213's hard-condition/exception policy; #398/#399's feedback and close-reason
rules; #361's Inbox service contract; #376's unconfirmed public recovery channel;
#74/#78's internal-content/task rules; #84's source lifecycle and external-source
authorization scope. These are not skipped solely because AI Ready is No.

Rollback: revert local batch commit; no business data was modified.
