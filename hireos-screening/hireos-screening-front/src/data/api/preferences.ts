import type { PreferencesData } from "../fixtures/preferences";
import { apiFetch } from "./shared";

export async function getPreferences(): Promise<PreferencesData> {
  return apiFetch<PreferencesData>("/preferences");
}

export async function activateProposal(proposalId: string, activatedBy: "morgan"): Promise<PreferencesData> {
  void activatedBy; // server derives the activator from the authenticated session
  return apiFetch<PreferencesData>(`/preferences/proposals/${proposalId}/activate`, { method: "POST" });
}

export async function rejectProposal(proposalId: string): Promise<PreferencesData> {
  return apiFetch<PreferencesData>(`/preferences/proposals/${proposalId}/reject`, { method: "POST" });
}

export async function rollbackToVersion(versionId: string, activatedBy: "morgan"): Promise<PreferencesData> {
  void activatedBy; // server derives the activator from the authenticated session
  return apiFetch<PreferencesData>(`/preferences/versions/${versionId}/rollback`, { method: "POST" });
}
