export interface ActivityEntry {
  id: string;
  op: string;
  actor: string;
  target: string;
  status: "succeeded" | "failed" | "partial";
  detail?: string;
  at: string;
}
