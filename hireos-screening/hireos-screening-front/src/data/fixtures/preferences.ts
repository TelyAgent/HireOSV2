import { daysAgo } from "../../lib/daysAgo";
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

export const PREFERENCES: PreferencesData = {
  organization: {
    scope: "Organization",
    status: "active",
    owner: "People Ops",
    rules: [{ feature: "Prohibited: name, photo, school prestige, employment gaps as standalone signals", locked: true }],
  },
  team: {
    scope: "Team — Platform Engineering",
    status: "active",
    owner: "daniel",
    rules: [{ feature: "Slight emphasis on distributed-systems depth for backend roles", weightAdjustment: "+0.03 to Technical Depth" }],
  },
  role: { scope: "Role — Senior Backend Engineer (confirmed rubric)", status: "active", pointerOnly: true },
  user: {
    scope: "User — Emma Wilson (personal view only)",
    status: "active",
    rules: [{ feature: "Personal sort: boost Ownership & 0→1 in my own candidate list view", weightAdjustment: "+0.05 (view-only, does not change team scoring)" }],
  },
  proposed: [
    {
      id: "prop-1",
      scope: "team",
      title: "Proposed: increase Communication weight for customer-facing backend roles",
      sampleSize: 34,
      window: "Last 60 days",
      basis: "Derived from 34 eligible feedback events where Communication strength was marked important by reviewers.",
      status: "proposed",
      createdAt: daysAgo(4),
    },
  ],
  signals: [
    { id: "sig-1", feature: "Ownership & 0→1 evidence", direction: "increase", strength: 0.6, source: "34 shortlist/advance actions, last 60 days", eligibility: "eligible" },
    { id: "sig-2", feature: "Communication clarity", direction: "increase", strength: 0.4, source: "21 advance actions citing communication strength", eligibility: "eligible" },
    { id: "sig-3", feature: "Company prestige / brand name", direction: "increase", strength: 0.2, source: "Pattern detected in 9 advance actions", eligibility: "prohibited" },
  ],
  versions: [
    { id: "v-3", label: "v3 (current)", activatedAt: daysAgo(21), activatedBy: "morgan" },
    { id: "v-2", label: "v2", activatedAt: daysAgo(80), activatedBy: "morgan" },
    { id: "v-1", label: "v1 (initial)", activatedAt: daysAgo(150), activatedBy: "morgan" },
  ],
};
