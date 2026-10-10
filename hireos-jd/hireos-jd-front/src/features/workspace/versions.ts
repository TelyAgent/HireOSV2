/**
 * JD ID and published versions: API client plus the block diff used by the publish dialog and the
 * version history ("what changed since v2?").
 */
import { API_BASE_URL } from "../../lib/apiBase";
import { blockLevel, blockPlainText } from "./docHelpers";
import type { CoreJobDto } from "../jobs/jobsApi";
import type { BlockLevel, DocBlock, DocMeta } from "../../data/types";

const JOBS = `${API_BASE_URL}api/jobs`;

export interface JdVersion {
  versionNo: number;
  /** e.g. JD-2026-0012@v3 */
  code: string;
  title: string;
  blocks: DocBlock[];
  meta: DocMeta | null;
  note: string;
  publishedBy: string;
  publishedAt: string;
}
export interface JdVersions {
  jdCode: string;
  versions: JdVersion[];
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = body as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Request failed (${response.status})`);
  }
  return body as T;
}

/** The job's JD ID (assigned on first read) and its published versions, oldest first. */
export async function getVersions(jobId: string): Promise<JdVersions> {
  return parseOrThrow<JdVersions>(await fetch(`${JOBS}/${jobId}/versions`));
}

/** Publishes the saved document at `revision` as the next version (and opens the job if it's a draft). */
export async function publishVersion(
  jobId: string,
  body: { revision: number; note: string; publishedBy: string },
): Promise<{ version: JdVersion; job: CoreJobDto }> {
  const response = await fetch(`${JOBS}/${jobId}/publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow(response);
}

/* ---------------- diff ---------------- */

export interface BlockDiff {
  added: { block: DocBlock; section: string }[];
  removed: { block: DocBlock; section: string }[];
  edited: { id: string; section: string; before: string; after: string }[];
  level: { id: string; section: string; text: string; from: BlockLevel; to: BlockLevel }[];
  reordered: boolean;
  count: number;
}

/** Section heading each block sits under. */
function sectionOf(blocks: DocBlock[]) {
  const map = new Map<string, string>();
  let current = "";
  for (const b of blocks) {
    if (b.kind === "h2") current = blockPlainText(b);
    map.set(b.id, current);
  }
  return map;
}

/** Block-level changes from `prev` to `next` (matched by block id). */
export function diffBlocks(prev: DocBlock[], next: DocBlock[]): BlockDiff {
  const pm = new Map(prev.map((b) => [b.id, b]));
  const nm = new Map(next.map((b) => [b.id, b]));
  const ps = sectionOf(prev);
  const ns = sectionOf(next);
  const out: BlockDiff = { added: [], removed: [], edited: [], level: [], reordered: false, count: 0 };
  for (const b of next) {
    const o = pm.get(b.id);
    if (!o) {
      out.added.push({ block: b, section: ns.get(b.id) ?? "" });
      continue;
    }
    const before = blockPlainText(o);
    const after = blockPlainText(b);
    if (before !== after) out.edited.push({ id: b.id, section: ns.get(b.id) ?? "", before, after });
    if (blockLevel(o) !== blockLevel(b)) out.level.push({ id: b.id, section: ns.get(b.id) ?? "", text: after, from: blockLevel(o), to: blockLevel(b) });
  }
  for (const b of prev) if (!nm.has(b.id)) out.removed.push({ block: b, section: ps.get(b.id) ?? "" });
  const keptPrev = prev.filter((b) => nm.has(b.id)).map((b) => b.id).join(",");
  const keptNext = next.filter((b) => pm.has(b.id)).map((b) => b.id).join(",");
  out.reordered = keptPrev !== keptNext;
  out.count = out.added.length + out.removed.length + out.edited.length + out.level.length + (out.reordered ? 1 : 0);
  return out;
}
