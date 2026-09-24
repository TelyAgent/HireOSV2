import { daysAgo, hoursAgo } from "../../lib/daysAgo";

export interface ActivityEntry {
  id: string;
  op: string;
  actor: string;
  target: string;
  status: "succeeded" | "failed" | "partial";
  detail?: string;
  at: string;
}

export const ACTIVITY: ActivityEntry[] = [
  { id: "act-1", op: "Upload", actor: "emma", target: "alex_morgan_resume_v2.pdf", status: "succeeded", at: daysAgo(2) },
  { id: "act-2", op: "Email read", actor: "System (scheduled)", target: "Recruiting intake mailbox — 3 messages matched", status: "succeeded", at: hoursAgo(3) },
  { id: "act-3", op: "Folder scan", actor: "System (scheduled)", target: "/Shared Drives/Recruiting/Resumes — 1 new file", status: "succeeded", at: hoursAgo(1) },
  { id: "act-4", op: "Email read", actor: "System (scheduled)", target: "Hiring manager referrals mailbox", status: "failed", detail: "Authorization required", at: daysAgo(6) },
  { id: "act-5", op: "Download", actor: "daniel", target: "Screening package — Morgan Blake (review only)", status: "succeeded", at: daysAgo(7) },
  { id: "act-6", op: "API import", actor: "API (demo ingestion)", target: "candidate_batch_2026-08-30.csv — partial success (4/6 rows)", status: "partial", at: daysAgo(9) },
  { id: "act-7", op: "Upload", actor: "emma", target: "candidate_notes_draft.tmp — unsupported file type", status: "failed", at: daysAgo(9) },
  { id: "act-8", op: "Preview", actor: "daniel", target: "casey_chen_resume.docx", status: "succeeded", at: daysAgo(2) },
];
