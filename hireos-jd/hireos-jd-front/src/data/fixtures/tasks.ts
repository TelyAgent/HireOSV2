/** HumanTask queue and saved views. */
import { daysAgo, daysFromNow } from "../../lib/format";
import type { HumanTask } from "../types";

export const TASKS: HumanTask[] = [
  { id:'task-1', jobId:'job-demo-101', type:'Complete requirements', title:'Complete requirements for HR Lead', assignee:'linh', status:'in_progress', priority:'high', dueAt:daysFromNow(1,17), createdAt:daysAgo(1) },
  { id:'task-2', jobId:'job-demo-102', type:'Review / approve JD', title:'Review & approve Senior Backend Engineer (HR step)', assignee:'alex', status:'open', priority:'urgent', dueAt:daysFromNow(1,12), createdAt:daysAgo(1) },
  { id:'task-3', jobId:'job-demo-102', type:'Resolve conflict', title:'Resolve must-have vs. preferred conflict: B2B SaaS platforms', assignee:'maya', status:'open', priority:'high', dueAt:daysFromNow(2,17), createdAt:daysAgo(2) },
  { id:'task-4', jobId:'job-demo-102', type:'Review downstream impact', title:'Review downstream impact of role v3 → v4 change', assignee:null, queue:'JD Admin queue', status:'open', priority:'normal', dueAt:daysFromNow(3,17), createdAt:daysAgo(1) },
  { id:'task-5', jobId:null, type:'Review imported material', title:'Review unassigned file: cs-lead-jd-archive.pdf', assignee:null, queue:'Intake queue', status:'open', priority:'low', dueAt:daysFromNow(5,17), createdAt:daysAgo(3) },
  { id:'task-6', jobId:null, type:'Review imported material', title:'Review unassigned file: backend-team-org-chart.png', assignee:'linh', status:'waiting', waitingReason:'Waiting on Maya to confirm which job this belongs to.', priority:'low', dueAt:null, createdAt:daysAgo(4) },
  { id:'task-7', jobId:'job-demo-103', type:'Recover failed operation', title:'Recover withdrawal for Finance Manager (Careers site)', assignee:'linh', status:'in_progress', priority:'normal', dueAt:daysFromNow(2,17), createdAt:daysAgo(4) },
  { id:'task-8', jobId:'job-demo-102', type:'Review public JD', title:'Review External JD v3 draft before re-publishing', assignee:'linh', status:'completed', priority:'normal', dueAt:daysAgo(2), createdAt:daysAgo(9), completedAt:daysAgo(2) },
  { id:'task-9', jobId:'job-demo-101', type:'Complete requirements', title:'Clarify must-have vs preferred for HR Lead', assignee:'alex', status:'open', priority:'normal', dueAt:daysFromNow(4,17), createdAt:daysAgo(1) },
  { id:'task-10', jobId:'job-demo-102', type:'Review / approve JD', title:'Review & approve Senior Backend Engineer (HM step)', assignee:'maya', status:'completed', priority:'urgent', dueAt:daysAgo(1), createdAt:daysAgo(2), completedAt:daysAgo(1) },
  { id:'task-11', jobId:'job-demo-107', type:'Resolve conflict', title:'Confirm job-demo-107 is a repost of job-demo-106 and withdraw the duplicate', assignee:'linh', status:'open', priority:'high', dueAt:daysFromNow(2,17), createdAt:daysAgo(12) },
  { id:'task-12', jobId:'job-demo-114', type:'Resolve conflict', title:'Reconcile the two differently-worded “Strategic Investment Associate” postings (job-demo-112 vs job-demo-114)', assignee:'alex', status:'open', priority:'normal', dueAt:daysFromNow(3,17), createdAt:daysAgo(30) },
  { id:'task-13', jobId:'job-demo-115', type:'Review / approve JD', title:'Reconcile scope with the existing draft “HR Lead” job (job-demo-101) before this goes external', assignee:'alex', status:'open', priority:'urgent', dueAt:daysFromNow(1,17), createdAt:daysAgo(9) },
];

export const SAVED_VIEWS: readonly string[] = ['All Jobs','My Jobs','Published','Needs My Attention','Drafts','Pending Approval','Recently Updated'];
