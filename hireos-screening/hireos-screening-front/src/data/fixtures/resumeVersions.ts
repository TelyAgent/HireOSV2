export interface ResumeVersion {
  id: string;
  version: number;
  fileName: string;
  uploadedAt: string;
  source: string;
  parseStatus: "succeeded" | "failed" | "pending";
  isLatest: boolean;
  changeNote?: string;
}
