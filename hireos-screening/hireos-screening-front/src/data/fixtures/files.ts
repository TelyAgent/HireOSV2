import { daysAgo } from "../../lib/daysAgo";

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

export const FILES: FileRecord[] = [
  { id: "file-1", name: "alex_morgan_resume.pdf", type: "PDF", sizeKB: 184, source: "Manual upload", uploadedAt: daysAgo(19), readStatus: "available", extraction: "complete", security: "passed", linked: "Alex Morgan" },
  { id: "file-2", name: "alex_morgan_resume_v2.pdf", type: "PDF", sizeKB: 201, source: "Manual upload", uploadedAt: daysAgo(2), readStatus: "available", extraction: "complete", security: "passed", linked: "Alex Morgan" },
  { id: "file-3", name: "jordan_lee_resume.pdf", type: "PDF", sizeKB: 156, source: "Manual upload", uploadedAt: daysAgo(15), readStatus: "available", extraction: "complete", security: "passed", linked: "Jordan Lee" },
  { id: "file-4", name: "casey_chen_resume.docx", type: "DOCX", sizeKB: 98, source: "Folder watch", uploadedAt: daysAgo(13), readStatus: "available", extraction: "complete", security: "passed", linked: "Casey Chen" },
  { id: "file-5", name: "riley_thompson_resume.pdf", type: "PDF", sizeKB: 172, source: "Manual upload", uploadedAt: daysAgo(6), readStatus: "available", extraction: "complete", security: "passed", linked: "Riley Thompson" },
  { id: "file-6", name: "morgan_blake_resume.pdf", type: "PDF", sizeKB: 140, source: "Manual upload", uploadedAt: daysAgo(9), readStatus: "available", extraction: "complete", security: "passed", linked: "Morgan Blake" },
  { id: "file-7", name: "taylor_brooks_resume.pdf", type: "PDF", sizeKB: 163, source: "Manual upload", uploadedAt: daysAgo(8), readStatus: "available", extraction: "complete", security: "passed", linked: "Taylor Brooks" },
  { id: "file-8", name: "priya_shah_resume.pdf", type: "PDF", sizeKB: 190, source: "API (demo ingestion)", uploadedAt: daysAgo(2), readStatus: "available", extraction: "complete", security: "passed", linked: "Priya Shah" },
  { id: "file-9", name: "a_morgan_finance_resume.pdf", type: "PDF", sizeKB: 132, source: "Email import", uploadedAt: daysAgo(11), readStatus: "available", extraction: "complete", security: "passed", linked: "Alex Morgan (Finance)" },
  { id: "file-10", name: "senior_backend_engineer_JD.txt", type: "TXT", sizeKB: 12, source: "Manual upload", uploadedAt: daysAgo(21), readStatus: "available", extraction: "complete", security: "passed", linked: "Job: Senior Backend Engineer" },
  { id: "file-11", name: "engineering_lead_JD.txt", type: "TXT", sizeKB: 9, source: "Manual upload", uploadedAt: daysAgo(10), readStatus: "available", extraction: "complete", security: "passed", linked: "Job: Engineering Lead" },
  { id: "file-12", name: "candidate_batch_2026-08-30.csv", type: "CSV", sizeKB: 6, source: "API (demo ingestion)", uploadedAt: daysAgo(9), readStatus: "available", extraction: "partial", security: "passed", linked: "Unassigned" },
];
