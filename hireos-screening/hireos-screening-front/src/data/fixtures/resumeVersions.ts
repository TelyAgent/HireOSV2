import { daysAgo, hoursAgo } from "../../lib/daysAgo";

export interface ResumeVersion {
  id: string;
  version: number;
  fileName: string;
  uploadedAt: string;
  source: string;
  parseStatus: "succeeded" | "failed";
  isLatest: boolean;
  changeNote?: string;
}

export const RESUME_VERSIONS: Record<string, ResumeVersion[]> = {
  "cand-alex": [
    { id: "rv-alex-1", version: 1, fileName: "alex_morgan_resume.pdf", uploadedAt: daysAgo(19), source: "Manual upload", parseStatus: "succeeded", isLatest: false },
    { id: "rv-alex-2", version: 2, fileName: "alex_morgan_resume_v2.pdf", uploadedAt: daysAgo(2), source: "Manual upload", parseStatus: "succeeded", isLatest: true, changeNote: "Added detail on checkout latency project and service migration ownership." },
  ],
  "cand-am2": [{ id: "rv-am2-1", version: 1, fileName: "a_morgan_finance_resume.pdf", uploadedAt: daysAgo(11), source: "Email import", parseStatus: "succeeded", isLatest: true }],
  "cand-jordan": [{ id: "rv-jordan-1", version: 1, fileName: "jordan_lee_resume.pdf", uploadedAt: daysAgo(15), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-casey": [{ id: "rv-casey-1", version: 1, fileName: "casey_chen_resume.docx", uploadedAt: daysAgo(13), source: "Folder watch", parseStatus: "succeeded", isLatest: true }],
  "cand-riley": [{ id: "rv-riley-1", version: 1, fileName: "riley_thompson_resume.pdf", uploadedAt: daysAgo(6), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-morganb": [{ id: "rv-morganb-1", version: 1, fileName: "morgan_blake_resume.pdf", uploadedAt: daysAgo(9), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-taylor": [{ id: "rv-taylor-1", version: 1, fileName: "taylor_brooks_resume.pdf", uploadedAt: daysAgo(8), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-priya": [{ id: "rv-priya-1", version: 1, fileName: "priya_shah_resume.pdf", uploadedAt: daysAgo(2), source: "API (demo ingestion)", parseStatus: "succeeded", isLatest: true }],
  "cand-morgane": [{ id: "rv-morgane-1", version: 1, fileName: "morgan_ellis_resume.pdf", uploadedAt: daysAgo(1), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-samo": [{ id: "rv-samo-1", version: 1, fileName: "sam_okafor_resume.pdf", uploadedAt: daysAgo(52), source: "Email import", parseStatus: "succeeded", isLatest: true }],
  "cand-jamier": [
    { id: "rv-jamier-1", version: 1, fileName: "jamie_rivera_resume.pdf", uploadedAt: daysAgo(35), source: "Folder watch", parseStatus: "succeeded", isLatest: false },
    { id: "rv-jamier-2", version: 2, fileName: "jamie_rivera_resume_updated.pdf", uploadedAt: daysAgo(8), source: "Email import", parseStatus: "succeeded", isLatest: true, changeNote: "Added on-call tooling ownership and MTTR improvement detail." },
  ],
  "cand-devonp": [{ id: "rv-devonp-1", version: 1, fileName: "devon_park_resume.pdf", uploadedAt: daysAgo(4), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-avag": [{ id: "rv-avag-1", version: 1, fileName: "ava_guzman_resume.pdf", uploadedAt: daysAgo(6), source: "API (demo ingestion)", parseStatus: "succeeded", isLatest: true }],
  "cand-leom": [{ id: "rv-leom-1", version: 1, fileName: "leo_martins_resume.pdf", uploadedAt: daysAgo(3), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-quinnf": [{ id: "rv-quinnf-1", version: 1, fileName: "quinn_foster_resume.pdf", uploadedAt: daysAgo(60), source: "Folder watch", parseStatus: "succeeded", isLatest: true }],
  "cand-harpers": [{ id: "rv-harpers-1", version: 1, fileName: "harper_singh_resume.pdf", uploadedAt: hoursAgo(3), source: "Manual upload", parseStatus: "succeeded", isLatest: true }],
  "cand-noahb": [{ id: "rv-noahb-1", version: 1, fileName: "noah_bennett_resume.pdf", uploadedAt: daysAgo(20), source: "Email import", parseStatus: "succeeded", isLatest: true }],
};
