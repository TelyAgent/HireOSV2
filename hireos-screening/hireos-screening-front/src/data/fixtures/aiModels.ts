import { daysAgo, hoursAgo } from "../../lib/daysAgo";

export interface AiModelCatalogEntry {
  id: string;
  provider: string;
  model: string;
  status: "active" | "not_evaluated";
  region: "us" | "eu";
  dataClass: "standard" | "restricted";
}
export interface AiTaskPolicy {
  taskType: string;
  primary: string;
  fallback: string | null;
  budgetMonthly: number;
  qualityGate: "passed" | "needs_review";
}
export interface AiUsageRow {
  taskType: string;
  calls30d: number;
  p95LatencyMs: number;
  costUsd: number;
}
export interface AiEvent {
  id: string;
  type: "fallback" | "budget" | "region_blocked" | "quality";
  detail: string;
  at: string;
}

export interface AiModelsData {
  catalog: AiModelCatalogEntry[];
  taskPolicies: AiTaskPolicy[];
  usage: AiUsageRow[];
  events: AiEvent[];
}

export const AI_MODELS: AiModelsData = {
  catalog: [
    { id: "m-1", provider: "Anthropic (sample)", model: "Claude Sonnet — Screening Evaluate", status: "active", region: "us", dataClass: "standard" },
    { id: "m-2", provider: "OpenAI (sample)", model: "GPT-4o mini — Resume Parse", status: "active", region: "us", dataClass: "standard" },
    { id: "m-3", provider: "Cohere (sample)", model: "Embed v3 — Duplicate Similarity", status: "active", region: "us", dataClass: "standard" },
    { id: "m-4", provider: "Anthropic (sample)", model: "Claude Haiku — Fallback / Evidence Extract", status: "active", region: "us", dataClass: "standard" },
    { id: "m-5", provider: "Regional Partner (sample)", model: "Local-EU Parse Model", status: "not_evaluated", region: "eu", dataClass: "restricted" },
  ],
  taskPolicies: [
    { taskType: "resume_parse", primary: "m-2", fallback: "m-4", budgetMonthly: 400, qualityGate: "passed" },
    { taskType: "profile_normalize", primary: "m-2", fallback: "m-4", budgetMonthly: 150, qualityGate: "passed" },
    { taskType: "duplicate_similarity", primary: "m-3", fallback: null, budgetMonthly: 120, qualityGate: "passed" },
    { taskType: "job_discovery / prelink_match", primary: "m-1", fallback: "m-4", budgetMonthly: 600, qualityGate: "passed" },
    { taskType: "screening_evaluate / evidence_extract", primary: "m-1", fallback: "m-4", budgetMonthly: 900, qualityGate: "passed" },
    { taskType: "candidate_compare", primary: "m-1", fallback: "m-4", budgetMonthly: 200, qualityGate: "needs_review" },
    { taskType: "preference_signal_extract", primary: "m-4", fallback: null, budgetMonthly: 80, qualityGate: "passed" },
  ],
  usage: [
    { taskType: "screening_evaluate", calls30d: 214, p95LatencyMs: 4200, costUsd: 38.52 },
    { taskType: "resume_parse", calls30d: 96, p95LatencyMs: 1800, costUsd: 6.1 },
    { taskType: "job_discovery", calls30d: 88, p95LatencyMs: 3300, costUsd: 11.4 },
    { taskType: "candidate_compare", calls30d: 12, p95LatencyMs: 5100, costUsd: 4.85 },
  ],
  events: [
    { id: "aie-1", type: "fallback", detail: "screening_evaluate: primary model timeout on 1 request — routed to Claude Haiku (fallback).", at: daysAgo(1) },
    { id: "aie-2", type: "budget", detail: "candidate_compare: 92% of monthly budget used — approaching cap.", at: hoursAgo(6) },
    { id: "aie-3", type: "region_blocked", detail: "Local-EU Parse Model excluded from routing for this workspace: data residency policy requires US region.", at: daysAgo(5) },
    { id: "aie-4", type: "quality", detail: "candidate_compare quality gate flagged for re-review after last evaluation run (0.81 vs. 0.85 threshold).", at: daysAgo(3) },
  ],
};
