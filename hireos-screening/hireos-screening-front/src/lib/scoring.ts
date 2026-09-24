import { translate } from "../data/i18n";
import type { Lang } from "../store/types";

/** Deterministic score aggregation, ported verbatim from the prototype
 * (Interface Spec §5.2): coverage-gated overall score, "Unknown" stays
 * `null` rather than being guessed at below the coverage threshold. */
export interface DimensionForAggregate {
  weight: number;
  status: "evaluated" | "unknown" | "not_evaluated" | "not_applicable";
  score: number | null;
}
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
export function computeAggregate(
  dims: DimensionForAggregate[],
  minCoverage?: number,
): { coverage: number; overall: number | null } {
  const min = minCoverage == null ? 0.7 : minCoverage;
  const applicable = dims.filter((d) => d.status !== "not_applicable");
  const totalW = applicable.reduce((s, d) => s + d.weight, 0) || 1;
  const evaluated = applicable.filter((d) => d.status === "evaluated" && typeof d.score === "number");
  const evalW = evaluated.reduce((s, d) => s + d.weight, 0);
  const coverage = totalW ? evalW / totalW : 0;
  let overall: number | null = null;
  if (coverage >= min && evalW > 0) {
    overall = evaluated.reduce((s, d) => s + d.weight * (d.score as number), 0) / evalW;
  }
  return { coverage: round2(coverage), overall: overall == null ? null : round1(overall) };
}

export type EligibilityResultStatus = "met" | "not_met" | "unknown" | "conflicting" | "provisionally_met";
export type EligibilityStatus = "eligible" | "likely_eligible" | "needs_verification" | "not_eligible";
export function aggregateEligibility(results: { status: EligibilityResultStatus }[]): EligibilityStatus {
  if (results.some((r) => r.status === "not_met")) return "not_eligible";
  if (results.some((r) => r.status === "unknown" || r.status === "conflicting")) return "needs_verification";
  if (results.some((r) => r.status === "provisionally_met")) return "likely_eligible";
  return "eligible";
}

/** Confidence display per Patch 1 rule: reuse the overall/coverage engine, no
 * percentages, coverage-gated buckets. */
export function confidenceLabel(
  r: { eligibility?: EligibilityStatus; proposalSource?: string; confidence: number | null },
  lang: Lang,
): string {
  if (r.eligibility === "not_eligible") return translate(lang, "Not eligible — confidence not shown");
  if (r.proposalSource === "manual") return translate(lang, "Manually added — no AI confidence score");
  if (r.confidence == null) return translate(lang, "Insufficient evidence to estimate confidence");
  const p = Math.round(r.confidence * 100);
  if (p >= 70) return translate(lang, "Strong match signal");
  if (p >= 40) return translate(lang, "Some match signal");
  return translate(lang, "Limited match signal");
}

/** Deterministic pseudo-random generator (same candidate+job always yields
 * the same simulated result). */
export function seededRandom(seedStr: string): () => number {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0;
  return function next() {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

const DIRECTION_STOPWORDS = new Set([
  "and",
  "the",
  "of",
  "for",
  "with",
  "team",
  "engineer",
  "engineering",
  "manager",
  "lead",
  "senior",
  "junior",
  "staff",
  "remote",
  "unassigned",
]);
export function extractKeywords(text: string | null | undefined): string[] {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !DIRECTION_STOPWORDS.has(w));
}

/** Direction pre-filter: coarse keyword overlap between job team/title and
 * candidate tags, used to avoid running full multidimensional matching
 * against every job in the library. */
export function candidateMatchesDirection(
  candidate: { tags?: string[] },
  job: { team: string; title: string },
): boolean {
  const jobWords = new Set([...extractKeywords(job.team), ...extractKeywords(job.title)]);
  if (jobWords.size === 0) return true; // job has no usable direction signal — don't silently exclude everyone
  for (const tag of candidate.tags || []) {
    for (const w of extractKeywords(tag)) {
      if (jobWords.has(w)) return true;
    }
  }
  return false;
}

/** Lightweight eligibility simulation — only checks the one hard-requirement
 * type this prototype can reason about (work authorization) without real
 * resume parsing. Everything else defaults to eligible. */
/** Inferred AI recommendation badge for a screening evaluation — a display
 * derivation only, never itself an approval/rejection action. Ported
 * verbatim from the prototype's `inferRecommendation`. */
export type InferredRecommendation = "strong_advance" | "advance" | "review" | "do_not_advance";
export function inferRecommendation(
  ev: { eligibilityStatus?: EligibilityStatus; evaluationStatus?: string; overall: number | null } | null | undefined,
): InferredRecommendation | null {
  if (!ev) return null;
  if (ev.eligibilityStatus === "not_eligible") return "do_not_advance";
  if (ev.evaluationStatus === "insufficient_evidence") return "review";
  if (ev.overall == null) return "review";
  if (ev.overall >= 80 && ev.eligibilityStatus === "eligible") return "strong_advance";
  if (ev.overall >= 65) return "advance";
  return "review";
}

export function quickEligibilityCheck(
  candidate: { workAuth?: { status: string } },
  job: { requirements?: { hard: boolean; kind: string }[] },
): EligibilityStatus {
  const hardAuthReq = (job.requirements || []).some((r) => r.hard && r.kind === "authorization");
  if (hardAuthReq && candidate.workAuth && candidate.workAuth.status === "unknown") return "needs_verification";
  return "eligible";
}
