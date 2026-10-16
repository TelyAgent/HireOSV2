import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { CandidatesService } from './candidates.service';
import { DiscoveryService } from '../discovery/discovery.service';
import type { Identity } from '../auth/workspace.guard';
import { z } from 'zod';
import { invalidSchemaFromZod } from '../http/invalid-schema';

@Injectable()
export class LibraryService {
  constructor(
    private readonly db: PrismaService,
    private readonly candidates: CandidatesService,
    private readonly discovery: DiscoveryService,
  ) {}

  /**
   * The Resume Library (F04): every candidate in the workspace, searched by name, email or tag (#171) and
   * filtered by tag, latest source, owner, match status and date added (#172). `total` is the whole library,
   * so the page can say "N of M"; `facets` are the values the filters can offer.
   */
  async list(identity: Identity, raw: unknown = {}) {
    const parsed = libraryQuerySchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const filters = parsed.data;
    const candidates = await this.db.candidate.findMany({
      where: { workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        libraryEntry: true,
        profiles: { orderBy: { version: 'desc' }, take: 1 },
        resumeVersions: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
          include: { material: { select: { name: true } } },
        },
        applications: { select: { jobId: true, status: true } },
      },
    });
    const candidateIds = candidates.map((candidate) => candidate.id);
    const [recommendations, matchingStatuses] = await Promise.all([
      this.db.candidateJobRecommendation.findMany({
        where: { workspaceId: identity.workspaceId, candidateId: { in: candidateIds } },
        select: { candidateId: true, status: true },
      }),
      this.discovery.getMatchingStatuses(identity.workspaceId, candidateIds),
    ]);
    const rows = candidates.map((candidate) => {
      const pending = recommendations.filter((item) => item.candidateId === candidate.id && item.status === 'proposed').length;
      // Linked roles: the distinct jobs this candidate has a current application for (#174).
      const linkedJobs = new Set(candidate.applications.filter((a) => a.status !== 'withdrawn').map((a) => a.jobId));
      const matching = matchingStatuses.get(candidate.id) ?? { isMatching: false, lastRun: null };
      return {
        candidate: this.candidates.toFrontendCandidate(candidate, candidate.profiles[0]),
        latestSource: candidate.resumeVersions[0]?.source || 'structured_entry',
        matchStatus: matchStatusOf(matching, pending),
        matchReason: (matching.lastRun?.reason as { message?: string } | null)?.message ?? undefined,
        isMatching: matching.isMatching,
        linkedRoleCount: linkedJobs.size,
        pendingRecommendationCount: pending,
        addedAt: candidate.createdAt,
      };
    });
    const q = filters.q?.toLowerCase();
    const items = rows.filter(({ candidate, latestSource, matchStatus, addedAt }) => {
      const tags = candidate.tags.map((tag) => tag.toLowerCase());
      if (q && !(
        candidate.displayName.toLowerCase().includes(q)
        || (candidate.contact.email ?? '').toLowerCase().includes(q)
        || tags.some((tag) => tag.includes(q))
      )) return false;
      if (filters.tag && !tags.includes(filters.tag.toLowerCase())) return false;
      if (filters.source && latestSource !== filters.source) return false;
      if (filters.owner && candidate.ownerId !== filters.owner) return false;
      if (filters.matchStatus && matchStatus !== filters.matchStatus) return false;
      if (filters.addedFrom && addedAt < startOfDay(filters.addedFrom)) return false;
      if (filters.addedTo && addedAt >= startOfDay(filters.addedTo, 1)) return false;
      return true;
    }).map(({ addedAt: _addedAt, ...row }) => row);
    return {
      items,
      total: rows.length,
      facets: {
        tags: countBy(rows.flatMap((row) => row.candidate.tags)),
        sources: countBy(rows.map((row) => row.latestSource)),
        owners: countBy(rows.map((row) => row.candidate.ownerId)),
        matchStatuses: countBy(rows.map((row) => row.matchStatus)),
      },
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
});

/** Midnight UTC of a YYYY-MM-DD day, optionally some days later. */
function startOfDay(value: string, plusDays = 0) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + plusDays);
  return date;
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }));
}
