/** Files, connections and operation activity (Files & Integrations). */
import { daysAgo, daysFromNow, hoursAgo } from "../../lib/format";
import type { Connection, FileItem, OpActivity } from "../types";

export const FILES: FileItem[] = [
  { id:'file-1', name:'HM-notes-senior-backend.docx', jobId:'job-demo-102', size:'38 KB', kind:'docx', source:'Upload', uploadedBy:'linh', uploadedAt:daysAgo(28), consumption:'accepted' },
  { id:'file-2', name:'finance-manager-req.pdf', jobId:'job-demo-103', size:'112 KB', kind:'pdf', source:'Email import', uploadedBy:'sam', uploadedAt:daysAgo(65), consumption:'accepted' },
  { id:'file-3', name:'q4-hr-lead-brief.txt', jobId:'job-demo-101', size:'4 KB', kind:'txt', source:'Paste', uploadedBy:'linh', uploadedAt:daysAgo(1), consumption:'accepted' },
  { id:'file-4', name:'cs-lead-jd-archive.pdf', jobId:null, size:'89 KB', kind:'pdf', source:'Folder watch', uploadedBy:null, uploadedAt:daysAgo(3), consumption:'unassigned' },
  { id:'file-5', name:'backend-team-org-chart.png', jobId:null, size:'220 KB', kind:'image', source:'Email import', uploadedBy:null, uploadedAt:daysAgo(4), consumption:'unassigned' },
  { id:'file-6', name:'design-portfolio-template.pdf', jobId:'job-demo-104', size:'1.4 MB', kind:'pdf', source:'Upload', uploadedBy:'maya', uploadedAt:daysAgo(140), consumption:'accepted' },
  { id:'file-7', name:'corrupted-scan.pdf', jobId:null, size:'0 KB', kind:'pdf', source:'Email import', uploadedBy:null, uploadedAt:daysAgo(2), consumption:'failed', error:'File could not be used — unreadable scan.' },
];

export const CONNECTIONS: Connection[] = [
  { id:'conn-1', kind:'email', name:'hiring@sendinglabs.com', status:'connected', owner:'linh', scope:'Inbox: subject contains "JD" or "requisition"', lastReadAt:hoursAgo(2), nextReadAt:daysFromNow(0,15), mode:'automatic' },
  { id:'conn-2', kind:'folder', name:'Shared Drive / Hiring Intake', status:'paused', owner:'linh', scope:'Root + subfolders, PDF/DOCX only', lastReadAt:daysAgo(3), nextReadAt:null, mode:'automatic' },
  { id:'conn-3', kind:'email', name:'finance-hiring@sendinglabs.com', status:'authorization_required', owner:'sam', scope:'Inbox, all mail', lastReadAt:daysAgo(20), nextReadAt:null, mode:'manual' },
];

export const OP_ACTIVITY: OpActivity[] = [
  { id:'op-1', type:'read_run', connection:'conn-1', status:'partially_succeeded', at:hoursAgo(2), counts:{discovered:6,matched:5,succeeded:4,skipped:1,failed:1}, actor:'system' },
  { id:'op-2', type:'upload', file:'file-3', status:'succeeded', at:daysAgo(1), actor:'linh' },
  { id:'op-3', type:'read_run', connection:'conn-2', status:'succeeded', at:daysAgo(3), counts:{discovered:2,matched:2,succeeded:2,skipped:0,failed:0}, actor:'system' },
  { id:'op-4', type:'consumption_failed', file:'file-7', status:'failed', at:daysAgo(2), actor:'system', error:'File could not be used — unreadable scan.' },
  { id:'op-5', type:'download', file:'file-6', status:'ready', at:daysAgo(1), actor:'maya' },
  { id:'op-6', type:'read_run', connection:'conn-1', status:'succeeded', at:daysAgo(1), counts:{discovered:3,matched:3,succeeded:3,skipped:0,failed:0}, actor:'system' },
];
