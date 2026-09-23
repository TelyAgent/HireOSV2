# HireOS Written Test (Assessment) Backend

Backend service for the "笔试" (written test / assessment) subsystem. See
`../docs/hireos-assessment-prototype.html` for the reference design and
`../hireos-written-front/` for the frontend (currently fixture-driven, no
backend calls yet).

## Phase 0 status

Implemented:

- bare NestJS + `@nestjs/config` scaffold;
- `GET /api/health`.

Not yet implemented (deliberately deferred):

- database connection (no Prisma/schema yet — this phase is scaffold-only);
- dev-auth / `WorkspaceGuard` identity pattern (see the sibling backends —
  `hireos-screening-backend`, `hireos-interview` backend, `hireos-jd-backend`
  — for the pattern to follow once real endpoints exist);
- any domain modules (questions, cases, invitations, attempts, evaluations,
  etc. — see the frontend's `src/data/fixtures.ts` for the target data
  model, ported from the prototype's seed data).

Registered on port 3008 (see `../../PORTS.md`).
