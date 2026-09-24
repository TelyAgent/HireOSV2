import { db } from "../db";
import type { PreferencesData } from "../fixtures/preferences";
import { uid } from "../../lib/daysAgo";
import { ApiError, delay } from "./shared";
import { apiFetch, isRealApi } from "./shared";

export async function getPreferences(): Promise<PreferencesData> {
  if (isRealApi()) return apiFetch<PreferencesData>("/preferences");
  await delay();
  return db.preferences;
}

export async function activateProposal(proposalId: string, activatedBy: "morgan"): Promise<PreferencesData> {
  if (isRealApi()) return apiFetch<PreferencesData>(`/preferences/proposals/${proposalId}/activate`, { method: "POST" });
  const proposal = db.preferences.proposed.find((p) => p.id === proposalId);
  if (!proposal) throw new ApiError("NOT_FOUND", `Proposal ${proposalId} not found`);
  await delay(500);
  db.preferences.proposed = db.preferences.proposed.filter((p) => p.id !== proposalId);
  db.preferences.versions.unshift({ id: uid("v"), label: `v${db.preferences.versions.length + 1} (current)`, activatedAt: new Date().toISOString(), activatedBy });
  return db.preferences;
}

export async function rejectProposal(proposalId: string): Promise<PreferencesData> {
  if (isRealApi()) return apiFetch<PreferencesData>(`/preferences/proposals/${proposalId}/reject`, { method: "POST" });
  const proposal = db.preferences.proposed.find((p) => p.id === proposalId);
  if (!proposal) throw new ApiError("NOT_FOUND", `Proposal ${proposalId} not found`);
  await delay(400);
  db.preferences.proposed = db.preferences.proposed.filter((p) => p.id !== proposalId);
  return db.preferences;
}

export async function rollbackToVersion(versionId: string, activatedBy: "morgan"): Promise<PreferencesData> {
  if (isRealApi()) return apiFetch<PreferencesData>(`/preferences/versions/${versionId}/rollback`, { method: "POST" });
  const version = db.preferences.versions.find((v) => v.id === versionId);
  if (!version) throw new ApiError("NOT_FOUND", `Version ${versionId} not found`);
  await delay(500);
  db.preferences.versions.unshift({ id: uid("v"), label: `v${db.preferences.versions.length + 1} (current, rolled back to ${version.label})`, activatedAt: new Date().toISOString(), activatedBy });
  return db.preferences;
}
