# Issue #288 local follow-up

Date: 2026-10-17 (Asia/Shanghai)
Branch: codex/issue-fixes
Scope: local fixes and verification only; no PR, push, or issue closure.

## Changes

- Include expectedEvidence in the round score response projection.
- Label the rubric evidence expectation as expected, not as a verified missing fact.
- Prompt reviewers to record the actual evidence gap in their note.
- Add service regression fixtures for numeric-to-null updates, readback, and mixed/all-Unknown summaries.

## Executed checks

All commands exited 0.

Backend (hireos-interview/job-Interview-backend):
- npm run build && node --test test/unknown-scores.test.cjs: 2 passed.
- npm run typecheck && npm run lint && npm test: 45 passed, none skipped; test rebuilds backend.

Frontend (hireos-interview/job-Interview-front):
- npm run typecheck && npm test: 12 passed, none skipped.
- npm run build: passed; existing Vite chunk-size warning.

Repository:
- git diff --check: passed.

## Evidence limits

The new backend tests execute real service methods with a controlled in-memory database double, not HTTP or real Prisma persistence. They verify null readback and evaluated-weight exclusion. The existing summary does not expose a numeric weighted total; that separate feature was not implemented here. Frontend assertions check source text, not rendered browser behavior. No browser or deployed-environment acceptance is claimed, and no cross-round score-selection policy is changed.
