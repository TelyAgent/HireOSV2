# HireOS JD Backend

This service owns the JD workflow boundary while Core Record owns the
authoritative Job and RoleDefinitionVersion records.

## Local development

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

The service listens on `http://127.0.0.1:3005/api`.

## Current Phase

The first backend slice supports:

- creating a JD draft for an existing Core Record Job;
- creating a Core Record `RoleDefinitionVersion`;
- confirming a draft and its corresponding role version;
- keeping a local JD draft projection for future collaboration and approval work.

Current endpoints:

```text
POST /api/jobs/:jobId/drafts
POST /api/jobs/:jobId/drafts/:draftId/confirm
```

The request must include `Idempotency-Key`. The JD service never connects
directly to the Core Record database; it calls the Core Record API.

## Ownership boundary

```text
Core Record:
  Job
  RoleDefinitionVersion
  JobRequirementSnapshot

JD:
  JobDraft
  future ChangeProposal / Approval / JDVersion / Publication

Screening:
  matching, screening policy, evaluation, decision and handoff
```

`JobCriteriaPage.tsx` remains a Screening frontend experience. Its existing
Screening API contract can later be backed by a facade that reads the
Core/JD versions without changing the page.

## One-off: v1 for jobs published before versions (#96)

Jobs published before JD versions existed have no v1. The original publish snapshot isn't stored anywhere,
so their v1 is the JD content at migration time:
- their saved document;
- or, if the document was never saved, the document their draft shows, which is saved too.

v1 is marked as a migration baseline: `meta.baseline`, publisher `system:jd-baseline-migration`, and a note.
Its time is the migration time. The original approval and publish time stay unknown.

```bash
npm run build
node dist/scripts/backfill-jd-baseline.js            # dry run: prints what would change, writes nothing
node dist/scripts/backfill-jd-baseline.js --apply    # writes; safe to run again (jobs with any version are skipped)
node dist/scripts/backfill-jd-baseline.js --rollback # removes baseline v1s that are still the job's only version
```

The script needs the service's `DATABASE_URL`, `CORE_RECORD_BASE_URL` and `SERVICE_TOKEN`. In the container,
run it with `docker exec <jd-backend> node dist/scripts/backfill-jd-baseline.js`; locally, add `--env-file=.env`.
Results per job:
- `created` / `would_create`;
- `has_versions`, `not_published` (Core status is not `open`) or `job_not_found` (deleted in Core): skipped.

Rollback keeps a baseline once the job has been published again, and removes a document it saved from a
draft only while nobody has edited that document since.
