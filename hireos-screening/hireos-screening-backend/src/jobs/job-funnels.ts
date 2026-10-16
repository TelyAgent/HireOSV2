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
      sources: [...sources.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count })),
    });
  }
  return result;
}
