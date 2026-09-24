import { db, getApplicationsForCandidate, getRecsForCandidate } from "../db";
import type { Candidate } from "../fixtures/candidates";
import type { JobDiscoveryRun } from "../fixtures/jobDiscovery";
import { uid, daysAgo } from "../../lib/daysAgo";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

export type MatchStatus = "linked" | "pending" | "no_match" | "failed" | "not_matched" | "running";

export interface LibraryEntry {
  candidate: Candidate;
  latestSource: string;
  matchStatus: MatchStatus;
  linkedRoleCount: number;
  pendingRecommendationCount: number;
}

function computeMatchStatus(candidateId: string): { status: MatchStatus; linked: number; pending: number } {
  const applications = getApplicationsForCandidate(candidateId);
  const recs = getRecsForCandidate(candidateId);
  const linked = applications.length;
  const pending = recs.filter((r) => r.status === "proposed").length;
  if (linked > 0) return { status: "linked", linked, pending };
  if (pending > 0) return { status: "pending", linked, pending };
  const discovery = db.jobDiscovery[candidateId];
  if (!discovery || discovery.status === "not_started") return { status: "not_matched", linked, pending };
  if (discovery.status === "running") return { status: "running", linked, pending };
  if (discovery.status === "failed") return { status: "failed", linked, pending };
  if (discovery.status === "no_match" || discovery.status === "no_open_jobs") return { status: "no_match", linked, pending };
  return { status: "not_matched", linked, pending };
}

function latestSourceFor(candidateId: string): string {
  const versions = db.resumeVersions[candidateId];
  if (!versions || versions.length === 0) return "Structured entry";
  const latest = versions.find((v) => v.isLatest) || versions[versions.length - 1];
  return latest.source;
}

export async function listLibraryEntries(query?: string): Promise<LibraryEntry[]> {
  if (isRealApi()) {
    const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
    return apiFetch<LibraryEntry[]>(`/library${suffix}`);
  }
  await delay();
  const q = (query || "").trim().toLowerCase();
  return Object.values(db.candidates)
    .filter((c) => {
      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.contact.email.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((candidate) => {
      const m = computeMatchStatus(candidate.id);
      return {
        candidate,
        latestSource: latestSourceFor(candidate.id),
        matchStatus: m.status,
        linkedRoleCount: m.linked,
        pendingRecommendationCount: m.pending,
      };
    });
}

export async function runMatchAgain(candidateId: string): Promise<JobDiscoveryRun> {
  if (isRealApi()) {
    const result = await apiFetch<JobDiscoveryRun>(`/candidates/${candidateId}/match`, { method: "POST" });
    db.jobDiscovery[candidateId] = result;
    return result;
  }
  if (!db.candidates[candidateId]) throw new ApiError("NOT_FOUND", `Candidate ${candidateId} not found`);
  db.jobDiscovery[candidateId] = { status: "running", lastRunAt: new Date().toISOString(), jobsScanned: 0 };
  await delay(900);
  const openJobs = Object.values(db.jobs).filter((j) => j.status === "open");
  const result: JobDiscoveryRun =
    openJobs.length === 0
      ? { status: "no_open_jobs", lastRunAt: new Date().toISOString(), jobsScanned: 0 }
      : { status: "recommendations_ready", lastRunAt: new Date().toISOString(), jobsScanned: openJobs.length };
  db.jobDiscovery[candidateId] = result;
  db.candidates[candidateId].lastMatchedAt = result.lastRunAt;
  return result;
}

export interface PasteProfileInput {
  name: string;
  email?: string;
  location?: string;
  notes?: string;
}

export async function pasteProfile(input: PasteProfileInput): Promise<Candidate> {
  if (isRealApi()) return apiFetch<Candidate>("/candidates", { method: "POST", body: JSON.stringify(input) });
  if (!input.name.trim()) throw new ApiError("NAME_REQUIRED", "Name is required");
  await delay();
  const id = uid("cand-manual");
  const candidate: Candidate = {
    id,
    displayName: input.name.trim(),
    identityStatus: "provisional",
    contact: { email: input.email || "", phone: "", location: { value: input.location || "", status: input.location ? "known" : "unknown" } },
    workAuth: { value: "", status: "unknown" },
    tags: [],
    owner: "emma",
    createdAt: daysAgo(0),
    lastMatchedAt: null,
    retention: "standard-24mo",
    libraryStatus: "available",
    compensationExpectation: null,
    missingFields: ["compensation_expectation", "work_authorization"],
    employment: input.notes ? [{ company: "(from pasted notes)", title: "", start: "", end: "", achievements: [input.notes] }] : [],
    skills: [],
    education: [],
  };
  db.candidates[id] = candidate;
  db.jobDiscovery[id] = { status: "not_started", lastRunAt: null, jobsScanned: 0 };
  db.resumeVersions[id] = [];
  return candidate;
}
