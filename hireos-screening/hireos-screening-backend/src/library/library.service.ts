import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { CandidatesService } from './candidates.service';
import { AUTO_MATCH_JOB, DiscoveryService } from '../discovery/discovery.service';
import type { Identity } from '../auth/workspace.guard';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { invalidSchemaFromZod } from '../http/invalid-schema';

@Injectable()
export class LibraryService {
  constructor(
    private readonly db: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly discovery: DiscoveryService,
  ) {}

  /**
   * The Resume Library (F04): candidates searched by name, email or tag (#171) and filtered by tag, latest
   * source, owner, match status and date added (#172). Everything but the match status is filtered in the
   * database, so no candidate is out of reach however large the library; the match status is worked out for
   * the candidates left. `matched` is how many fit, `items` the page of them from `offset`, `total` the whole library,
   * and `facets` the values the filters can offer.
   */
  async list(identity: Identity, raw: unknown = {}) {
    const parsed = libraryQuerySchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const filters = parsed.data;
    const workspaceId = identity.workspaceId;
    // Every filter, the match status included, is one SQL condition (#413): Postgres counts the matches and returns
    // only this page's ids, so no list of the library's candidates is read here, however large it is.
    const where = this.filterSql(workspaceId, filters);
    const [pageRows, [{ count }]] = await Promise.all([
      this.db.$queryRaw<Array<{ id: string }>>`
        SELECT c."id" FROM "Candidate" c WHERE ${where}
        ORDER BY c."createdAt" DESC, c."id" DESC LIMIT ${filters.limit} OFFSET ${filters.offset}`,
      this.db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM "Candidate" c WHERE ${where}`,
    ]);
    const pageIds = pageRows.map((row) => row.id);
    const [candidates, total, facets] = await Promise.all([
      this.db.candidate.findMany({
        where: { workspaceId, id: { in: pageIds } },
        include: {
          libraryEntry: true,
          profiles: { orderBy: { version: 'desc' }, take: 1 },
          resumeVersions: { orderBy: { uploadedAt: 'desc' }, take: 1, include: { material: { select: { name: true } } } },
          // Only the roles they are linked to are shown, so one row per job is enough.
          applications: { where: { status: { not: 'withdrawn' } }, distinct: ['jobId'], select: { jobId: true } },
        },
      }),
      this.db.candidate.count({ where: { workspaceId } }),
      this.facets(workspaceId),
    ]);
    const statuses = await this.matchStatusesOf(workspaceId, pageIds);
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const items = pageIds.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c).map((candidate) => {
      const status = statuses.get(candidate.id)!;
      // Linked roles: the distinct jobs this candidate has a current application for (#174).
      const linkedJobs = new Set(candidate.applications.map((a) => a.jobId));
      return {
        candidate: this.candidates.toFrontendCandidate(candidate, candidate.profiles[0]),
        latestSource: candidate.resumeVersions[0]?.source || 'structured_entry',
        matchStatus: status.matchStatus,
        matchReason: status.matchReason,
        isMatching: status.isMatching,
        linkedRoleCount: linkedJobs.size,
        pendingRecommendationCount: status.pending,
      };
    });
    return { items, matched: Number(count), total, facets };
  }

  /** The list's filters as one condition on `c` (a "Candidate" row). */
  private filterSql(workspaceId: string, filters: z.infer<typeof libraryQuerySchema>): Prisma.Sql {
    const conditions = [Prisma.sql`c."workspaceId" = ${workspaceId}`];
    if (filters.q) {
      const pattern = likePattern(filters.q);
      conditions.push(Prisma.sql`(c."displayName" ILIKE ${pattern} OR c."id" IN (${this.withEmailSql(workspaceId, pattern)}) OR c."id" IN (${this.withTagSql(workspaceId, pattern)}))`);
    }
    if (filters.tag) conditions.push(Prisma.sql`c."id" IN (${this.withTagSql(workspaceId, filters.tag.trim().toLowerCase())})`);
    if (filters.source === 'structured_entry') {
      conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "ResumeVersion" rv WHERE rv."candidateId" = c."id")`);
    } else if (filters.source) {
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "ResumeVersion" rv WHERE rv."candidateId" = c."id" AND rv."isLatest" AND rv."source" = ${filters.source})`);
    }
    if (filters.owner) conditions.push(Prisma.sql`c."ownerId" = ${filters.owner}`);
    // Prisma keeps DateTime as UTC wall time without a zone: compare in UTC, whatever the session's zone is.
    if (filters.addedFrom) conditions.push(Prisma.sql`c."createdAt" >= (${startOfDay(filters.addedFrom).toISOString()}::timestamptz AT TIME ZONE 'UTC')`);
    if (filters.addedTo) conditions.push(Prisma.sql`c."createdAt" < (${startOfDay(filters.addedTo, 1).toISOString()}::timestamptz AT TIME ZONE 'UTC')`);
    if (filters.matchStatus) conditions.push(Prisma.sql`(${matchStatusSql}) = ${filters.matchStatus}`);
    return Prisma.join(conditions, ' AND ');
  }

  /** Candidates whose latest profile has a skill matching the pattern (case-insensitive LIKE; no % = equal). */
  private withTagSql(workspaceId: string, pattern: string): Prisma.Sql {
    return Prisma.sql`
      SELECT latest."candidateId" FROM (
        SELECT DISTINCT ON ("candidateId") "candidateId", "skills" FROM "CandidateProfile"
        WHERE "workspaceId" = ${workspaceId} ORDER BY "candidateId", "version" DESC
      ) latest
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(latest."skills") = 'array' THEN latest."skills" ELSE '[]'::jsonb END) AS skill
        WHERE lower(CASE WHEN jsonb_typeof(skill) = 'object' THEN skill->>'name' ELSE skill#>>'{}' END) LIKE ${pattern}
      )`;
  }

  /**
   * Candidates whose shown email matches the pattern: the latest profile version's own email, or — for versions
   * from before contacts were recorded — the candidate's record (#171, review on PR #345).
   */
  private withEmailSql(workspaceId: string, pattern: string): Prisma.Sql {
    return Prisma.sql`
      SELECT e."id" FROM "Candidate" e
      LEFT JOIN LATERAL (
        SELECT p."contact" FROM "CandidateProfile" p WHERE p."candidateId" = e."id" ORDER BY p."version" DESC LIMIT 1
      ) latest ON true
      WHERE e."workspaceId" = ${workspaceId}
        AND lower(CASE WHEN latest."contact" IS NULL THEN coalesce(e."email", '') ELSE coalesce(latest."contact"->>'email', '') END) LIKE ${pattern}`;
  }

  private async matchStatusesOf(workspaceId: string, ids: string[]) {
    const [pending, matching] = await Promise.all([
      ids.length
        ? this.db.candidateJobRecommendation.groupBy({ by: ['candidateId'], where: { workspaceId, candidateId: { in: ids }, status: 'proposed' }, _count: { _all: true } })
        : Promise.resolve([] as Array<{ candidateId: string; _count: { _all: number } }>),
      this.discovery.getMatchingStatuses(workspaceId, ids),
    ]);
    const pendingOf = new Map(pending.map((p) => [p.candidateId, p._count._all]));
    return new Map(ids.map((id) => {
      const run = matching.get(id) ?? { isMatching: false, lastRun: null };
      const count = pendingOf.get(id) ?? 0;
      return [id, {
        matchStatus: matchStatusOf(run, count),
        matchReason: (run.lastRun?.reason as { message?: string } | null)?.message ?? undefined,
        isMatching: run.isMatching,
        pending: count,
      }];
    }));
  }

  /** The values the filters offer, counted over the whole library. */
  private async facets(workspaceId: string) {
    const [tags, sources, withoutResume, owners] = await Promise.all([
      this.db.$queryRaw<Array<{ value: string; count: bigint }>>`
        SELECT tag AS value, count(*) AS count FROM (
          SELECT DISTINCT ON ("candidateId") "candidateId", "skills" FROM "CandidateProfile"
          WHERE "workspaceId" = ${workspaceId} ORDER BY "candidateId", "version" DESC
        ) latest,
        LATERAL (
          SELECT DISTINCT CASE WHEN jsonb_typeof(skill) = 'object' THEN skill->>'name' ELSE skill#>>'{}' END AS tag
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(latest."skills") = 'array' THEN latest."skills" ELSE '[]'::jsonb END) AS skill
        ) tags
        WHERE tag IS NOT NULL AND tag <> ''
        GROUP BY tag ORDER BY count(*) DESC, tag LIMIT 200`,
      this.db.resumeVersion.groupBy({ by: ['source'], where: { workspaceId, isLatest: true }, _count: { _all: true } }),
      this.db.candidate.count({ where: { workspaceId, resumeVersions: { none: {} } } }),
      this.db.candidate.groupBy({ by: ['ownerId'], where: { workspaceId }, _count: { _all: true } }),
    ]);
    const sorted = (rows: Array<{ value: string; count: number }>) => rows.filter((r) => r.value && r.count > 0).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return {
      tags: tags.map((t) => ({ value: t.value, count: Number(t.count) })),
      sources: sorted([...sources.map((s) => ({ value: s.source, count: s._count._all })), { value: 'structured_entry', count: withoutResume }]),
      owners: sorted(owners.map((o) => ({ value: o.ownerId, count: o._count._all }))),
    };
  }
}

/**
 * F04 FR-5 / F06: what matching says about this candidate, kept apart from how many roles they're linked to.
 */
export const MATCH_STATUSES = ['not_started', 'running', 'recommendations', 'recommendations_handled', 'no_match', 'no_open_jobs', 'insufficient_data', 'failed'] as const;

function matchStatusOf(matching: { isMatching: boolean; lastRun: { status: string } | null }, pending: number): (typeof MATCH_STATUSES)[number] {
  if (matching.isMatching) return 'running';
  if (pending) return 'recommendations';
  switch (matching.lastRun?.status) {
    case undefined: return 'not_started';
    case 'recommendations_ready': return 'recommendations_handled';
    case 'no_match': return 'no_match';
    case 'no_open_jobs': return 'no_open_jobs';
    case 'insufficient_data': return 'insufficient_data';
    case 'failed': return 'failed';
    case 'running': return 'running';
    default: return 'not_started';
  }
}

/** "Contains the text", case-insensitively, with the text's own % and _ taken literally. */
function likePattern(text: string) {
  return `%${text.trim().toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * A candidate's match status in SQL, the same as matchStatusOf() over getMatchingStatuses() (#413): running while
 * a match job is queued or running, then "recommendations" while any is proposed, else from the latest run.
 */
const matchStatusSql = Prisma.sql`CASE
  WHEN EXISTS (SELECT 1 FROM "ProcessingJob" pj WHERE pj."workspaceId" = c."workspaceId" AND pj."type" = ${AUTO_MATCH_JOB} AND pj."candidateId" = c."id" AND pj."status" IN ('queued', 'running')) THEN 'running'
  WHEN EXISTS (SELECT 1 FROM "CandidateJobRecommendation" r WHERE r."workspaceId" = c."workspaceId" AND r."candidateId" = c."id" AND r."status" = 'proposed') THEN 'recommendations'
  ELSE CASE (SELECT run."status" FROM "JobDiscoveryRun" run WHERE run."workspaceId" = c."workspaceId" AND run."candidateId" = c."id" ORDER BY run."createdAt" DESC LIMIT 1)
    WHEN 'recommendations_ready' THEN 'recommendations_handled'
    WHEN 'no_match' THEN 'no_match'
    WHEN 'no_open_jobs' THEN 'no_open_jobs'
    WHEN 'insufficient_data' THEN 'insufficient_data'
    WHEN 'failed' THEN 'failed'
    WHEN 'running' THEN 'running'
    ELSE 'not_started'
  END
END`;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const libraryQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(80).optional(),
  source: z.string().trim().max(60).optional(),
  owner: z.string().trim().max(200).optional(),
  matchStatus: z.enum(MATCH_STATUSES).optional(),
  addedFrom: day.optional(),
  addedTo: day.optional(),
  // One page of the matching candidates: "Show more" asks for the next one by offset, each at most 500.
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Midnight UTC of a YYYY-MM-DD day, optionally some days later. */
function startOfDay(value: string, plusDays = 0) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + plusDays);
  return date;
}

