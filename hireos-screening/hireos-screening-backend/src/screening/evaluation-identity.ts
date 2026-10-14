import { createHash } from 'node:crypto';

// Issue #19: what an evaluation was produced by, and when a re-run may reuse an earlier result.

export const AI_EVALUATOR = 'ai-screening-evaluator-v1';
export const LOCAL_EVALUATOR = 'local-rule-evaluator-v1';

export type EvaluationMode = 'ai' | 'rules';
/** succeeded: the model scored it. not_used: scored by the local rules (no AI configured, or no resume text). */
export type AiStatus = 'succeeded' | 'not_used';

export type EvaluationInputIdentity = {
  evaluator: string;
  modelVersion: string | null;
  jobTitle: string;
  dimensions: unknown;
  hardRequirements: unknown;
  profileVersion: number | null;
  criteriaVersion: number | null;
  materialId: string | null;
  resumeText: string;
};

/**
 * Stable fingerprint of everything that can change a score: evaluator (prompt) version, model, job
 * title, rubric, profile/criteria versions and the exact resume text. Same fingerprint → same result.
 */
export function evaluationInputHash(input: EvaluationInputIdentity): string {
  const { resumeText, ...rest } = input;
  const canonical = JSON.stringify(sortKeys({ ...rest, resumeTextSha256: sha256(resumeText) }));
  return sha256(canonical);
}

/** The latest snapshot can stand in for a new run only if it's current, complete and from identical inputs. */
export function canReuseEvaluation(
  latest: { status: string; freshness: string; inputManifest: unknown } | null | undefined,
  inputHash: string,
): boolean {
  if (!latest || latest.status !== 'completed' || latest.freshness !== 'current') return false;
  const manifest = latest.inputManifest as { inputHash?: unknown } | null;
  return manifest?.inputHash === inputHash;
}

/** What gets recorded on the evaluation row, instead of the old hard-coded manual / not_requested / 0.68. */
export function evaluationMetadata(useAi: boolean, aiConfidence: number | null, modelVersion: string | null) {
  return useAi
    ? { evaluationMode: 'ai' as EvaluationMode, aiStatus: 'succeeded' as AiStatus, confidence: aiConfidence, modelVersion }
    : { evaluationMode: 'rules' as EvaluationMode, aiStatus: 'not_used' as AiStatus, confidence: null, modelVersion: null };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value as object).sort().map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]));
  }
  return value;
}
