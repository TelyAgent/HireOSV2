# HireOS Core Record Service

Core Record Service is the first shared business infrastructure service for
HireOS. It owns the cross-system master records for Candidate, Job, Application
and Material metadata.

## Phase 0 status

Implemented:

- NestJS + PostgreSQL + Prisma service boundary;
- dedicated `hireos_core_record` database and `core_record` schema;
- workspace-scoped development identity;
- Candidate create/get/patch/history;
- Job create/get/patch/history;
- Application idempotent create/get/status/history;
- Material metadata create/get/download authorization reference;
- optimistic version checks;
- required `Idempotency-Key` for create and update mutations;
- append-only AuditRecord;
- transactional OutboxEvent;
- structured 422 validation and 409 conflict responses.

The service does not yet migrate Screening's existing tables or call external
identity systems. Screening continues to run independently until the
CoreRecordClient compatibility phase is implemented.

## Run locally

```sh
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run start:dev
```

The default local service is:

```text
http://127.0.0.1:3004/api/v1
```

The local `.env` uses the PostgreSQL instance on port `55432` and the
`hireos_core_record` database with the `core_record` schema.

## API

```text
GET    /health

POST   /candidates
GET    /candidates/:id
PATCH  /candidates/:id
GET    /candidates/:id/history

POST   /jobs
GET    /jobs/:id
PATCH  /jobs/:id
GET    /jobs/:id/history

POST   /applications
GET    /applications/:id
PATCH  /applications/:id
POST   /applications/:id/status
GET    /applications/:id/history

POST   /materials
GET    /materials/:id
GET    /materials/:id/download

GET    /audit
GET    /outbox
```

All create and update requests should include:

```text
Idempotency-Key: stable-operation-key
X-Request-Id: request-id
X-Correlation-Id: correlation-id
```

Patch requests include `expectedVersion`. A stale version returns
`409 VERSION_CONFLICT`.

## Database boundary

```text
hireos_core_record
└── core_record
    ├── Candidate
    ├── Job
    ├── Application
    ├── Material
    ├── AuditRecord
    ├── IdempotencyKey
    └── OutboxEvent
```

Business subsystems must use this service API instead of writing these tables
directly.
