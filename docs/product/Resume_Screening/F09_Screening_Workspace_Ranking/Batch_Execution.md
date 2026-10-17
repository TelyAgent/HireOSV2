# Batch Execution and Recovery

## Scope

#200 is a progress-only parent. #424 covers durable execution (8 points); #425 covers the workspace and end-to-end acceptance (5 points). Owner confirmed both on 2026-10-17. Neither child alone completes #200. No new identity/role model or external broker is introduced.

## Contract

- `POST /api/jobs/:jobId/screening-batches`: `{idempotencyKey, applicationIds}`; 1-200 entries, deduplicated and sorted. The key is workspace-scoped and binds actor, job and exact membership. Matching replay returns the original batch; different contents return 409.
- `GET /api/jobs/:jobId/screening-batches`: latest 50 batches, newest first.
- `GET /api/screening-batches/:id`: persisted counts and items; no resume/input snapshot, provider body or lease credential is exposed.
- `POST /api/screening-batches/:id/cancel`: idempotently cancel queued items; running items finish normally. A cancelled batch cannot enqueue retries.
- `POST /api/screening-batches/:id/items/:itemId/retry`: `{idempotencyKey}`; only definite failed items, exact actor/key replays are read-only.
- `POST /api/screening-batches/:id/reconcile`: inspect durable results and expired leases, never invoke AI.

All endpoints retain the existing workspace guard. Cross-workspace batch access returns 404. Invalid membership/body returns 400; unknown outcome is not a successful evaluation.

## Execution

Creation uses a repeatable-read transaction to freeze all members' job, confirmed criteria, profile and resume contents, plus evaluator/model configuration. Later inputs do not alter that batch. A changed evaluator configuration is a definite pre-execution failure, not silent evaluation against a new model. Restoring configuration allows an explicit retry.

Every backend polls persisted work every two seconds, with at most eight locally active executions. A PostgreSQL advisory transaction lock serializes claims per workspace across processes; at most two items occupy workspace execution slots. Two batches cannot simultaneously claim the same application. Cancelling and retrying use the same workspace lock.

Leases last two minutes with a heartbeat every 40 seconds. Missing heartbeat turns running into unknown, never queued. Unknown items retain their slot: a timed-out remote provider may still be processing. This intentionally favors the concurrency guarantee over silently dispatching more work. Known HTTP/response-format failures are failed; timeout, transport uncertainty and transaction/persistence uncertainty are unknown. Error responses do not include provider text.

Evaluation data and completed item/evaluation ID commit in one transaction. Failure rolls back both. A late worker still owning the token can finish an unknown item exactly once through the normal worker path. Reconciliation only links a durable completed evaluation with its exact batchItemId. There is no automatic AI retry or claim takeover for unknown items.

Frozen results whose inputs no longer match the live criteria/profile/resume are stored stale, do not replace the current evaluation, do not change the application's current screening status and do not clear current human issue tasks. Evaluation version allocation is serialized against the application row for batch commits.

## Unknown Outcomes

Use the reconcile endpoint first. A durable matching completed evaluation resolves the item. If none exists, the outcome remains unknown and cannot be retried through the failed-item endpoint. Do not directly reset it to queued. Provider-level reconciliation/cancellation is not available in the current synchronous adapter; an operator must investigate provider and database records before any separately authorized correction. The system does not pretend to recover an unavailable provider result.

## Deployment and Rollback

Apply `20261017220000_screening_batches` before starting the new backend, then regenerate the Prisma client. This additive migration creates empty tables and changes no existing evaluations. Local migration was applied to `127.0.0.1:55432/hireos_screening`, not production.

Before rollback, prevent new batch creation and stop workers; let live executions finish where possible. Preserve batch tables and frozen inputs. On restart, queued items are available, completed records stay completed, interrupted calls become unknown. Never drop the tables or clear unknown records to force recovery. Snapshot retention follows the workspace's sensitive resume data policy; batch APIs never return that private snapshot.

## Verification

`test/screening-batches-db.test.cjs` applies migrations in disposable PostgreSQL schemas and verifies independent-client claim races, idempotent creation/retry, frozen input at the evaluator boundary, stale-result handling, cancellation, partial failure, commit rollback, unknown recovery, real HTTP controller round trips and tenant isolation. AI and mail providers are not contacted. Workspace browser/real-backend end-to-end acceptance belongs to #425.
