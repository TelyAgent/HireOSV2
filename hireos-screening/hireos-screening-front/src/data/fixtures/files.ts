export interface FileRecord {
  id: string;
  name: string;
  type: string;
  sizeKB: number;
  source: string;
  uploadedAt: string;
  readStatus: "available";
  extraction: "complete" | "partial" | "blocked" | "failed";
  security: "passed" | "quarantined";
  linked: string;
}
