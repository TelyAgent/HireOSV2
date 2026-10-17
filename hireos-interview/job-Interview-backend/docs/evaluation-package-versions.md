# Evaluation package versions

Issue: #317. API paths below are relative to the existing intake API prefix.

- `GET /tasks/:id/package` materializes the current content snapshot and returns
  `packageId`, `packageVersion`, `rubricVersion`, `generatedAt`, and `historical: false`.
- `GET /tasks/:id/package/versions` lists saved version numbers and creation times,
  newest first. It does not generate a version.
- `GET /tasks/:id/package/versions/:version` reads the immutable saved content with
  `historical: true`. Invalid version numbers return 400; absent or foreign-workspace
  snapshots return 404. There are no history update/delete endpoints.
- `GET /tasks/:id/package.pdf?version=N` exports exactly that saved version.
  Without the parameter it materializes and exports current content.

## Snapshot boundary

Versions are scoped to a task, begin at 1, and are independent of the task's edit
counter. Reading/exporting changed content creates a new snapshot; unchanged
reads reuse the original version and generation time. Confirmation changes are
included. A serializable transaction and unique task/version constraint protect
concurrent creation. The UI pins exports to the displayed version.

This is a materialized package history, not an event log of every source edit.
Intermediate edits never read as a package are not separately retained. Existing
historical packages cannot be reconstructed retroactively. Preview content can
also create a snapshot; `published` records its status at generation time.

Offer delivery and invalidation fields remain live operational state and do not
create content revisions. Historical responses do not replay those fields as
current state; the UI hides handoff actions and disables confirmations. New local
Offer handoffs reference the actual saved package version. Legacy handoff counters
are not reinterpreted or backfilled. This change does not implement upstream
invalidation or role authorization (#319/#318).

## Confirmation and handoff events (#320)

`GET /tasks/:id/package/events` returns workspace-scoped events in database
sequence order. Each event identifies the actor, action, package version, time,
and (for confirmation actions) HR/HM slot. Handoff-request events also retain the
two confirmation timestamps in that exact snapshot. They mean a local handoff
request, not downstream acceptance. No old timestamps are backfilled as events.

Confirmation/cancellation, snapshot creation and event insertion share a
serializable transaction. A failed event insert rolls back the operation. Handoff
claiming and its event likewise commit together. Reconfirmation creates a new
snapshot/event without rewriting the original handoff or its confirmations.
The UI displays the cross-version timeline separately from frozen package content.
Existing role authorization is unchanged; a recorded HR/HM slot is not proof of
the actor's business-role authorization.

## Deployment and rollback

Before running the new backend, from `hireos-interview/job-Interview-backend` run
`npm run prisma:migrate:deploy` against the intended database, then
`npm run prisma:generate` and `npm run build`. The additive migration is
`20261017100000_evaluation_package_versions`, followed by
`20261017110000_evaluation_package_events`. Both were exercised only in isolated
test schemas during local validation; no shared/production database was migrated.

Deploy the backend before the frontend that calls the new history routes. For
rollback, restore matching frontend/backend versions and retain the new table
and saved records. Do not drop snapshot data as part of an application rollback.

## Local verification

`test/package-versions.test.cjs` uses a real isolated PostgreSQL schema and HTTP
controller requests for concurrent reads, source changes, immutable history,
workspace isolation, invalid versions, versioned PDF and handoff version binding.
The frontend `test/package-versions.browser.cjs` runs Chrome with synthetic API
fixtures for navigation, read-only controls, exports, reload and failure recovery.
It is not a live frontend/backend deployment acceptance test.
