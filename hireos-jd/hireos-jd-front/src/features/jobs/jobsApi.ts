/**
 * Thin client for the real `hireos-jd-backend` Jobs endpoints (`/api/jobs`, itself a passthrough to
 * Core Record's job directory). Core Record's Job model is minimal — see `coreJobToLocalJob` in
 * `jobsMapping.ts` for how its handful of fields get merged into the richer local `Job` shape the rest
 * of this app expects.
 */

import { API_BASE_URL } from "../../lib/apiBase";
import { safeRandomUUID } from "../../lib/uuid";

const BASE = `${API_BASE_URL}api/jobs`;

export interface CoreJobDto {
  id: string;
  workspaceId: string;
  title: string;
  team?: string;
  location?: string;
  employmentType?: string;
  seniority?: string;
  status: string;
  openings: number;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = body as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Request failed (${response.status})`);
  }
  return body as T;
}

export async function listJobs(): Promise<CoreJobDto[]> {
  const response = await fetch(BASE);
  return parseOrThrow<CoreJobDto[]>(response);
}

export async function getJob(id: string): Promise<CoreJobDto | null> {
  const response = await fetch(`${BASE}/${id}`);
  if (response.status === 404) return null;
  return parseOrThrow<CoreJobDto>(response);
}

export async function deleteJob(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "DELETE",
    headers: { "idempotency-key": `job-delete-${id}-${safeRandomUUID()}` },
  });
  await parseOrThrow<{ id: string; deleted: boolean }>(response);
}
