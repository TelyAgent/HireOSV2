/** Approvals, publications, downstream impact and per-job activity. */
import { daysAgo, hoursAgo } from "../../lib/format";
import type { ActivityItem, Approval, Impact, Publication } from "../types";

export const APPROVALS: Record<string, Approval> = {
  'job-demo-102':{
    id:'appr-102-1', jobId:'job-demo-102', status:'pending', policy:'HM → HR (default)',
    candidateRevision:4, submittedBy:'linh', submittedAt:daysAgo(1),
    steps:[
      { id:'step-hm', order:1, role:'Hiring Manager', assignee:'maya', status:'approved', decidedAt:daysAgo(1), reason:null },
      { id:'step-hr', order:2, role:'HR', assignee:'alex', status:'active', decidedAt:null, reason:null },
    ],
    materialChanges:['Requirement wording change (communication skill)','New must-have: B2B SaaS platform experience'],
  },
  'job-demo-103':{
    id:'appr-103-1', jobId:'job-demo-103', status:'approved', policy:'HM → HR → Finance (budget step)',
    candidateRevision:2, submittedBy:'linh', submittedAt:daysAgo(58),
    steps:[
      { id:'step-hm3', order:1, role:'Hiring Manager', assignee:'sam', status:'approved', decidedAt:daysAgo(57), reason:null },
      { id:'step-hr3', order:2, role:'HR', assignee:'alex', status:'approved', decidedAt:daysAgo(56), reason:null },
      { id:'step-fin3', order:3, role:'Finance', assignee:'sam', status:'approved', decidedAt:daysAgo(55), reason:null },
    ],
  },
  'job-demo-104':{
    id:'appr-104-1', jobId:'job-demo-104', status:'approved', policy:'HM → HR (default)',
    candidateRevision:2, submittedBy:'linh', submittedAt:daysAgo(135),
    steps:[
      { id:'step-hm4', order:1, role:'Hiring Manager', assignee:'maya', status:'approved', decidedAt:daysAgo(134), reason:null },
      { id:'step-hr4', order:2, role:'HR', assignee:'alex', status:'approved', decidedAt:daysAgo(133), reason:null },
    ],
  },
};

export const PUBLICATIONS: Record<string, Publication[]> = {
  'job-demo-102':[
    { id:'pub-102-careers', channel:'Careers site', status:'published', publishedAt:daysAgo(19), versionRef:'ExternalJD v2', url:'https://careers.sendinglabs.com/jobs/senior-backend-engineer' },
    { id:'pub-102-linkedin', channel:'LinkedIn Jobs', status:'published', publishedAt:daysAgo(19), versionRef:'ExternalJD v2', url:'https://linkedin.example.com/jobs/demo-102' },
  ],
  'job-demo-103':[
    { id:'pub-103-careers', channel:'Careers site', status:'withdrawal_pending', publishedAt:daysAgo(50), versionRef:'ExternalJD v1', url:'https://careers.sendinglabs.com/jobs/finance-manager' },
  ],
  'job-demo-104':[
    { id:'pub-104-careers', channel:'Careers site', status:'withdrawn', publishedAt:daysAgo(130), withdrawnAt:daysAgo(30), versionRef:'ExternalJD v1', url:null },
  ],
  'job-demo-106':[ { id:'pub-106-vnw', channel:'VietnamWorks', status:'published', publishedAt:daysAgo(45), versionRef:'ExternalJD v1', url:'https://employer.vietnamworks.com/job/v3/candidates?jobId=1937823' } ],
  'job-demo-107':[ { id:'pub-107-vnw', channel:'VietnamWorks', status:'published', publishedAt:daysAgo(12), versionRef:'ExternalJD v1', url:'https://employer.vietnamworks.com/job/v3/candidates?jobId=1985301' } ],
  'job-demo-108':[ { id:'pub-108-vnw', channel:'VietnamWorks', status:'published', publishedAt:daysAgo(30), versionRef:'ExternalJD v1', url:'https://employer.vietnamworks.com/job/v3/candidates?jobId=1952124' } ],
  'job-demo-109':[ { id:'pub-109-vnw', channel:'VietnamWorks', status:'published', publishedAt:daysAgo(22), versionRef:'ExternalJD v1', url:'https://employer.vietnamworks.com/job/v3/candidates?jobId=2052573' } ],
  'job-demo-110':[ { id:'pub-110-vnw', channel:'VietnamWorks', status:'published', publishedAt:daysAgo(18), versionRef:'ExternalJD v1', url:'https://employer.vietnamworks.com/job/v3/candidates?jobId=2058789' } ],
  'job-demo-111':[ { id:'pub-111-vnw', channel:'VietnamWorks', status:'published', publishedAt:daysAgo(15), versionRef:'ExternalJD v1', url:'https://employer.vietnamworks.com/job/v3/candidates?jobId=2069485' } ],
};

export const IMPACT: Record<string, Impact> = {
  'job-demo-102':{ screening:{count:12, asOf:hoursAgo(3), availability:'available'}, assessment:{count:4, asOf:hoursAgo(6), availability:'available'}, interview:{count:null, asOf:null, availability:'unavailable'} },
};

export const JOB_ACTIVITY: Record<string, ActivityItem[]> = {
  'job-demo-115':[
    { at:hoursAgo(5), actor:'alex', text:'Confirmed role version 1 for HR Lead — Vietnam New Business Units.' },
    { at:daysAgo(9), actor:'linh', text:'Added job from real Sending Labs posting (no VietnamWorks link on file — sourced from internal records).' },
  ],
  'job-demo-114':[
    { at:daysAgo(60), actor:'linh', text:'Held as draft pending review — differently-worded duplicate of job-demo-112 under the same title.' },
  ],
  'job-demo-107':[
    { at:daysAgo(12), actor:'linh', text:'Identified as a likely repost of job-demo-106 (identical text, different VietnamWorks Job ID) — flagged rather than merged.' },
    { at:daysAgo(12), actor:'linh', text:'Published ExternalJD v1 to VietnamWorks.' },
  ],
  'job-demo-102':[
    { at:hoursAgo(1), actor:'linh', text:'Submitted working draft revision 4 for approval (HM → HR).' },
    { at:daysAgo(1), actor:'maya', text:'Approved step 1 (Hiring Manager).' },
    { at:daysAgo(2), actor:'ai', text:'Generated a rewrite suggestion for the communication requirement.', tag:'AI' },
    { at:daysAgo(2), actor:'linh', text:'Commented on “B2B SaaS platforms” requirement.' },
    { at:daysAgo(2), actor:'maya', text:'Replied to comment on “B2B SaaS platforms” requirement.' },
    { at:daysAgo(6), actor:'linh', text:'Identified a restricted field (age preference) in uploaded source material — sent for policy review.' },
    { at:daysAgo(9), actor:'alex', text:'Resolved comment on compensation.' },
    { at:daysAgo(19), actor:'linh', text:'Published ExternalJD v2 to Careers site and LinkedIn Jobs.' },
    { at:daysAgo(20), actor:'alex', text:'Activated role version 3 (confirmed standard).' },
    { at:daysAgo(21), actor:'system', text:'Job opened.' },
  ],
};
