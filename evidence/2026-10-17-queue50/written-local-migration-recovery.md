# Written local tasks API recovery - 2026-10-17

Related scope: #397/#399 close-decision persistence. User reported HTTP 500 from `http://localhost:8080/written/api/tasks` after the direct merge.

- Reproduced HTTP 500. Local Written log reported Prisma P2022: `Case.closeDecision` does not exist, from TasksService.list's task.findMany query.
- `npx prisma migrate status` exited 1 and identified exactly one pending migration: `20261017113000_close_decision`.
- Verified target is local PostgreSQL `127.0.0.1:55432`, database `hireos_written`, schema `public`. Read the migration: it only adds nullable JSONB `Case.closeDecision`.
- Ran the configured `npm run prisma:migrate:deploy` in `hireos-written/hireos-written-backend`; exit 0, one migration applied. No reset, deletion or fabricated historical audit data.
- Re-requested the exact localhost endpoint: HTTP 200, JSON keys items/nextCursor, 5 items. Response records were not copied into evidence.
- Re-ran `npx prisma migrate status`; exit 0, schema up to date.

No application code changes, production migrations or new automated-suite runs. This updates the earlier local-only migration status for Written only; it does not claim Interview or production migrations have been applied. The previous temporary-schema tests did not migrate the running local database.
