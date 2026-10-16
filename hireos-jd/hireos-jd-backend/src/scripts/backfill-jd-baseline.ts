/**
 * #96 — gives every job published before JD versions existed its v1 "migration baseline".
 *
 *   node dist/scripts/backfill-jd-baseline.js            dry run: lists what would change, writes nothing
 *   node dist/scripts/backfill-jd-baseline.js --apply    writes the v1s
 *   node dist/scripts/backfill-jd-baseline.js --rollback removes baseline v1s that are still a job's only version
 *
 * Safe to run again: jobs that already have a version are skipped. Needs DATABASE_URL, CORE_RECORD_BASE_URL
 * and SERVICE_TOKEN like the service itself (locally: `node --env-file=.env dist/scripts/...`).
 */
import { ConfigService } from '@nestjs/config';
import { CoreRecordClient } from '../core/core-record.client';
import { PrismaService } from '../persistence/prisma.service';
import { MIGRATION_ACTOR, VersionsService, type BaselineOutcome } from '../drafts/versions.service';

export async function run(db: PrismaService, versions: VersionsService, mode: 'dry-run' | 'apply' | 'rollback') {
  // Every job this service holds JD content for; a job with none has nothing to freeze.
  const [drafts, documents] = await Promise.all([
    db.jobDraft.findMany({ select: { workspaceId: true, jobId: true }, distinct: ['workspaceId', 'jobId'] }),
    db.jobDocument.findMany({ select: { workspaceId: true, jobId: true }, distinct: ['workspaceId', 'jobId'] }),
  ]);
  const jobs = new Map([...drafts, ...documents].map((row) => [`${row.workspaceId}/${row.jobId}`, row]));
  const results: Array<{ workspaceId: string } & (BaselineOutcome | { jobId: string; result: string; error?: string })> = [];
  for (const { workspaceId, jobId } of jobs.values()) {
    const identity = { workspaceId, actorId: MIGRATION_ACTOR, roles: [], kind: 'service' as const };
    try {
      if (mode === 'rollback') results.push({ workspaceId, jobId, result: await versions.rollbackBaseline(identity, jobId) });
      else results.push({ workspaceId, ...(await versions.backfillBaseline(identity, jobId, { apply: mode === 'apply' })) });
    } catch (error) {
      results.push({ workspaceId, jobId, result: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }
  const summary: Record<string, number> = {};
  for (const r of results) summary[r.result] = (summary[r.result] ?? 0) + 1;
  return { mode, summary, results };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args.includes('--rollback') ? 'rollback' : args.includes('--apply') ? 'apply' : 'dry-run';
  const db = new PrismaService();
  const versions = new VersionsService(db, new CoreRecordClient(new ConfigService()));
  run(db, versions, mode)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.summary.error ? 1 : 0;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
