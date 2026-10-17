import { Prisma } from '@prisma/client';
import type { PrismaService } from '../persistence/prisma.service';

/**
 * The per-job funnel of the jobs list (#141), worked out from rows already read: each collection is grouped by
 * job once, and each job then reads only its own rows — the work grows with the number of rows, not rows × jobs.
 * Counted in people, each stage a subset of the previous one: Resumes (evaluated against the job, plus anyone
 * matched or linked) → Matched (a live AI recommendation, linked included) → Linked (an Application exists).
 */
export type FunnelRow = { candidateId: string; jobId: string };
export type FunnelRecommendation = FunnelRow & { status: string };
export type ResumeInfo = { source: string; version: number; isLatest: boolean; today: boolean };
export type JobFunnel = { resumes: number; matched: number; linked: number; pending: number; today: number; sources: Array<{ source: string; count: number }> };

function byJob<T extends { jobId: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.jobId);
    if (group) group.push(row);
    else groups.set(row.jobId, [row]);
  }
  return groups;
}

export function computeJobFunnels(
  jobIds: string[],
  evaluations: FunnelRow[],
  recs: FunnelRecommendation[],
  applications: FunnelRow[],
  resumeInfo: Map<string, ResumeInfo>,
): Map<string, JobFunnel> {
  const [evaluationsByJob, recsByJob, applicationsByJob] = [byJob(evaluations), byJob(recs), byJob(applications)];
  const result = new Map<string, JobFunnel>();
  for (const jobId of jobIds) {
    const linked = new Set((applicationsByJob.get(jobId) ?? []).map((a) => a.candidateId));
    const jobRecs = recsByJob.get(jobId) ?? [];
    const matched = new Set([...linked, ...jobRecs.map((r) => r.candidateId)]);
    const pending = new Set(jobRecs.filter((r) => r.status === 'proposed' && !linked.has(r.candidateId)).map((r) => r.candidateId));
    const pool = new Set([...(evaluationsByJob.get(jobId) ?? []).map((e) => e.candidateId), ...matched]);
    const sources = new Map<string, number>();
    let today = 0;
    for (const id of pool) {
      const info = resumeInfo.get(id);
      if (!info) continue;
      sources.set(info.source, (sources.get(info.source) || 0) + 1);
      if (info.today) today++;
    }
    result.set(jobId, {
      resumes: pool.size,
      matched: matched.size,
      linked: linked.size,
      pending: pending.size,
      today,
      sources: [...sources.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([source, count]) => ({ source, count })),
    });
  }
  return result;
}

type FunnelDb = Pick<PrismaService, '$queryRaw'>;

/** Each candidate the job's funnel counts, once: evaluated against it, recommended for it, or linked to it. */
function poolSql(workspaceId: string, jobIds: string[]) {
  const jobs = Prisma.join(jobIds);
  return Prisma.sql`pool AS (
    SELECT "jobId", "candidateId",
      bool_or(kind IN ('recommended', 'proposed', 'linked')) AS matched,
      bool_or(kind = 'linked') AS linked,
      bool_or(kind = 'proposed') AS proposed
    FROM (
      SELECT "jobId", "candidateId", 'evaluated' AS kind FROM "PreLinkMatchEvaluation"
        WHERE "workspaceId" = ${workspaceId} AND "jobId" IN (${jobs})
      UNION ALL
      SELECT "jobId", "candidateId", CASE WHEN "status" = 'proposed' THEN 'proposed' ELSE 'recommended' END FROM "CandidateJobRecommendation"
        WHERE "workspaceId" = ${workspaceId} AND "jobId" IN (${jobs}) AND "status" IN ('proposed', 'deferred', 'confirmed')
      UNION ALL
      SELECT "jobId", "candidateId", 'linked' FROM "Application"
        WHERE "workspaceId" = ${workspaceId} AND "jobId" IN (${jobs})
    ) AS rows
    GROUP BY "jobId", "candidateId"
  )`;
}

/**
 * The same funnels as computeJobFunnels, counted in Postgres (#414): only one row per job (and one per job and
 * source) comes back, so the list no longer reads every evaluation, recommendation, application and résumé
 * version behind its open jobs. A candidate's source is that of their latest résumé version (isLatest, then the
 * highest version); "today" means any of their versions was uploaded since `startOfToday`.
 */
export async function aggregateJobFunnels(db: FunnelDb, workspaceId: string, jobIds: string[], startOfToday: Date): Promise<Map<string, JobFunnel>> {
  const result = new Map<string, JobFunnel>();
  if (!jobIds.length) return result;
  const [counts, sources] = await Promise.all([
    db.$queryRaw<Array<{ jobId: string; resumes: bigint; matched: bigint; linked: bigint; pending: bigint; today: bigint }>>`
      WITH ${poolSql(workspaceId, jobIds)},
      today AS (
        SELECT DISTINCT "candidateId" FROM "ResumeVersion"
        -- Prisma keeps DateTime as UTC wall time without a zone: compare in UTC, whatever the session's zone is.
        WHERE "workspaceId" = ${workspaceId} AND "uploadedAt" >= (${startOfToday.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND "candidateId" IN (SELECT "candidateId" FROM pool)
      )
      SELECT p."jobId",
        count(*) AS resumes,
        count(*) FILTER (WHERE p.matched) AS matched,
        count(*) FILTER (WHERE p.linked) AS linked,
        count(*) FILTER (WHERE p.proposed AND NOT p.linked) AS pending,
        count(t."candidateId") AS today
      FROM pool p LEFT JOIN today t ON t."candidateId" = p."candidateId"
      GROUP BY p."jobId"`,
    db.$queryRaw<Array<{ jobId: string; source: string; count: bigint }>>`
      WITH ${poolSql(workspaceId, jobIds)},
      latest AS (
        SELECT DISTINCT ON (rv."candidateId") rv."candidateId", coalesce(nullif(m."sourceType", ''), 'manual_upload') AS source
        FROM "ResumeVersion" rv JOIN "Material" m ON m."id" = rv."materialId"
        WHERE rv."workspaceId" = ${workspaceId} AND rv."candidateId" IN (SELECT "candidateId" FROM pool)
        ORDER BY rv."candidateId", rv."isLatest" DESC, rv."version" DESC
      )
      SELECT p."jobId", l.source, count(*) AS count
      FROM pool p JOIN latest l ON l."candidateId" = p."candidateId"
      GROUP BY p."jobId", l.source`,
  ]);
  const sourcesByJob = byJob(sources);
  for (const jobId of jobIds) {
    const row = counts.find((c) => c.jobId === jobId);
    result.set(jobId, {
      resumes: Number(row?.resumes ?? 0),
      matched: Number(row?.matched ?? 0),
      linked: Number(row?.linked ?? 0),
      pending: Number(row?.pending ?? 0),
      today: Number(row?.today ?? 0),
      sources: (sourcesByJob.get(jobId) ?? []).map((s) => ({ source: s.source, count: Number(s.count) })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
    });
  }
  return result;
}
