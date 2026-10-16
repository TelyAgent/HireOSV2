import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { CandidatesService } from './candidates.service';
import { DiscoveryService } from '../discovery/discovery.service';
import type { Identity } from '../auth/workspace.guard';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
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
    const and: Prisma.CandidateWhereInput[] = [];
    if (filters.q) {
      const tagIds = await this.candidateIdsWithTag(workspaceId, filters.q, 'contains');
      and.push({ OR: [
        { displayName: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
        { id: { in: tagIds } },
      ] });
    }
    if (filters.tag) and.push({ id: { in: await this.candidateIdsWithTag(workspaceId, filters.tag, 'equals') } });
    if (filters.source) {
      and.push(filters.source === 'structured_entry' ? { resumeVersions: { none: {} } } : { resumeVersions: { some: { isLatest: true, source: filters.source } } });
    }
    if (filters.owner) and.push({ ownerId: filters.owner });
    if (filters.addedFrom) and.push({ createdAt: { gte: startOfDay(filters.addedFrom) } });
    if (filters.addedTo) and.push({ createdAt: { lt: startOfDay(filters.addedTo, 1) } });
    const where: Prisma.CandidateWhereInput = { workspaceId, ...(and.length ? { AND: and } : {}) };

    let ids = (await this.db.candidate.findMany({ where, orderBy: { createdAt: 'desc' }, select: { id: true } })).map((c) => c.id);
    if (filters.matchStatus) {
      const statuses = await this.matchStatusesOf(workspaceId, ids);
      ids = ids.filter((id) => statuses.get(id)?.matchStatus === filters.matchStatus);
    }
    const pageIds = ids.slice(filters.offset, filters.offset + filters.limit);
    const [candidates, total, facets] = await Promise.all([
      this.db.candidate.findMany({
        where: { workspaceId, id: { in: pageIds } },
        include: {
          libraryEntry: true,
          profiles: { orderBy: { version: 'desc' }, take: 1 },
          resumeVersions: { orderBy: { uploadedAt: 'desc' }, take: 1, include: { material: { select: { name: true } } } },
          applications: { select: { jobId: true, status: true } },
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
      const linkedJobs = new Set(candidate.applications.filter((a) => a.status !== 'withdrawn').map((a) => a.jobId));
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
    return { items, matched: ids.length, total, facets };
  }

  /** Candidates whose latest profile has a skill equal to, or containing, the text (case-insensitive). */
  private async candidateIdsWithTag(workspaceId: string, text: string, mode: 'equals' | 'contains'): Promise<string[]> {
    const needle = text.trim().toLowerCase();
    const pattern = mode === 'equals' ? needle : `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await this.db.$queryRaw<Array<{ candidateId: string }>>`
      SELECT latest."candidateId" FROM (
        SELECT DISTINCT ON ("candidateId") "candidateId", "skills" FROM "CandidateProfile"
        WHERE "workspaceId" = ${workspaceId} ORDER BY "candidateId", "version" DESC
      ) latest
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(latest."skills") = 'array' THEN latest."skills" ELSE '[]'::jsonb END) AS skill
        WHERE lower(CASE WHEN jsonb_typeof(skill) = 'object' THEN skill->>'name' ELSE skill#>>'{}' END) LIKE ${pattern}
      )`;
    return rows.map((row) => row.candidateId);
  }

  /** The F06 matching state of each candidate, from their current recommendations and latest matching run. */
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

