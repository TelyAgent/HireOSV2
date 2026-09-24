export interface Assessment {
  status: "completed" | "not_administered";
  score?: number;
  scale?: number;
  completedAt?: string;
}
