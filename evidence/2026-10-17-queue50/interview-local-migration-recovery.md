# Interview local API recovery - 2026-10-17

User reported task detail, debrief, rounds and decision returning HTTP 500 on localhost:8080. All four reported endpoints reproduced 500. Local backend logs showed Prisma P2022 for missing CapabilityCard.requiredLevel and InterviewTask.decisionReason columns.

`npx prisma migrate status` exited 1 and identified five pending migrations in local PostgreSQL 127.0.0.1:55432, database hireos_interview/public:

- 20261017100000_evaluation_package_versions
- 20261017110000_evaluation_package_events
- 20261017114000_required_levels
- 20261017200000_question_skip_decision_audit
- 20261017203000_recommendation_reason

Read all five SQL migrations before applying. They add tables, columns, indexes and constraints; no reset or deletion. Ran the existing `npm run prisma:migrate:deploy` script in hireos-interview/job-Interview-backend: exit 0, all five applied.

Re-requested all four user-reported endpoints: task detail 200, debrief 200, rounds 200, decision 200. Responses parsed as JSON; candidate content was not copied into evidence. Final `npx prisma migrate status` exited 0, database schema up to date.

No business code change, production migration, candidate-score edit or new full-suite test run. This supersedes earlier evidence stating Interview migrations had only been applied to temporary test schemas: they are now also applied to the running local Interview database. Written local recovery is recorded separately.
