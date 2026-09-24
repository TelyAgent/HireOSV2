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
