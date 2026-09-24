import type { PersonId } from "./people";

export interface PreferenceRule {
  feature: string;
  locked?: boolean;
  weightAdjustment?: string;
}
export interface PreferenceLayer {
  scope: string;
  status: "active";
  owner?: string | PersonId;
  pointerOnly?: boolean;
  rules?: PreferenceRule[];
}
export interface ProposedPreference {
  id: string;
  scope: "organization" | "team" | "role" | "user";
  title: string;
  sampleSize: number;
  window: string;
  basis: string;
  status: "proposed";
  createdAt: string;
}
export interface FeedbackSignal {
  id: string;
  feature: string;
  direction: "increase" | "decrease";
  strength: number;
  source: string;
  eligibility: "eligible" | "prohibited";
}
export interface PreferenceVersion {
  id: string;
  label: string;
  activatedAt: string;
  activatedBy: PersonId;
}

export interface PreferencesData {
  organization: PreferenceLayer;
  team: PreferenceLayer;
  role: PreferenceLayer;
  user: PreferenceLayer;
  proposed: ProposedPreference[];
  signals: FeedbackSignal[];
  versions: PreferenceVersion[];
}
