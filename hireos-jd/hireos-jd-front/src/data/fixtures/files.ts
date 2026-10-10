/** Demo source-material files attached to jobs (shown in a job's Attachments tab). */
import { daysAgo } from "../../lib/format";
import type { FileItem } from "../types";

export const FILES: FileItem[] = [
  { id:'file-1', name:'HM-notes-senior-backend.docx', jobId:'job-demo-102', size:'38 KB', kind:'docx', source:'Upload', uploadedBy:'linh', uploadedAt:daysAgo(28), consumption:'accepted' },
  { id:'file-2', name:'finance-manager-req.pdf', jobId:'job-demo-103', size:'112 KB', kind:'pdf', source:'Email import', uploadedBy:'sam', uploadedAt:daysAgo(65), consumption:'accepted' },
  { id:'file-3', name:'q4-hr-lead-brief.txt', jobId:'job-demo-101', size:'4 KB', kind:'txt', source:'Paste', uploadedBy:'linh', uploadedAt:daysAgo(1), consumption:'accepted' },
  { id:'file-4', name:'cs-lead-jd-archive.pdf', jobId:null, size:'89 KB', kind:'pdf', source:'Folder watch', uploadedBy:null, uploadedAt:daysAgo(3), consumption:'unassigned' },
  { id:'file-5', name:'backend-team-org-chart.png', jobId:null, size:'220 KB', kind:'image', source:'Email import', uploadedBy:null, uploadedAt:daysAgo(4), consumption:'unassigned' },
  { id:'file-6', name:'design-portfolio-template.pdf', jobId:'job-demo-104', size:'1.4 MB', kind:'pdf', source:'Upload', uploadedBy:'maya', uploadedAt:daysAgo(140), consumption:'accepted' },
  { id:'file-7', name:'corrupted-scan.pdf', jobId:null, size:'0 KB', kind:'pdf', source:'Email import', uploadedBy:null, uploadedAt:daysAgo(2), consumption:'failed', error:'File could not be used — unreadable scan.' },
];
