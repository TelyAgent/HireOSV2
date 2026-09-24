/** Document drafts, comment threads and Copilot suggestions — from the prototype. */
import { daysAgo } from "../../lib/format";
import type { BlockKind, CommentThread, DocBlock, DocumentDraft, Suggestion } from "../types";

export function mkBlock(
  id: string,
  kind: BlockKind,
  text: string | string[],
  opts: { req?: string; role?: string; comment?: string | null; stale?: boolean } = {},
): DocBlock {
  return {
    id,
    kind,
    text,
    requirementRefs: opts.req ? [opts.req] : [],
    semanticRole: opts.role || "presentation_only",
    comment: opts.comment || null,
    stale: opts.stale || false,
    ...opts,
  };
}

export const DOCUMENTS: Record<string, DocumentDraft> = {
  'job-demo-102:internal': {
    id:'doc-102-internal', jobId:'job-demo-102', audience:'internal', language:'en', revision:7,
    saveState:'saved',
    blocks:[
      mkBlock('b1','h2','Senior Backend Engineer — Platform'),
      mkBlock('b2','p','Sending Labs is hiring a Senior Backend Engineer to own core services powering our checkout and billing infrastructure. This is a hybrid role based out of our Hanoi office, reporting to Maya Chen.'),
      mkBlock('b3','h2','Responsibilities'),
      mkBlock('b4','ul',['Own core services powering checkout and billing infrastructure','Design for reliability and scale across a distributed systems footprint','Partner with product and other engineering teams to scope and ship 0→1 initiatives']),
      mkBlock('b5','h2','Requirements — Must-have'),
      mkBlock('b6','ul',['Authorized to work in Vietnam','5+ years of professional backend engineering experience','Experience with distributed systems at meaningful scale','Must have strong communication skills.','Experience building B2B SaaS platforms'],{req:'req-102-comm'}),
      mkBlock('b7','h2','Preferred'),
      mkBlock('b8','ul',['Track record of owning a project from ambiguity to launch','Comfortable with periodic overlap with the US Pacific time zone']),
      mkBlock('b9','h2','Compensation'),
      mkBlock('b10','p','Internal budget ceiling: USD 7,000/month gross. — restricted, see Requirements → Compensation for visibility.',{role:'requirement',req:'req-102-comp'}),
      mkBlock('b11','h2','Success in the first 90 days'),
      mkBlock('b12','ul',['Onboarded to the checkout service codebase and on-call rotation','Shipped a measurable reliability improvement to the billing pipeline']),
    ],
  },
  'job-demo-102:external': {
    id:'doc-102-external', jobId:'job-demo-102', audience:'external', language:'en', revision:2,
    saveState:'saved',
    reviewStatus:'reviewed',
    blocks:[
      mkBlock('e1','h2','Senior Backend Engineer'),
      mkBlock('e2','p','Sending Labs is looking for a Senior Backend Engineer to help us build reliable, scalable checkout and billing infrastructure. You’ll work closely with product and engineering peers on high-impact 0→1 initiatives.'),
      mkBlock('e3','h2','What you’ll do'),
      mkBlock('e4','ul',['Own core backend services that power checkout and billing','Design for reliability and scale across distributed systems','Partner cross-functionally to ship new initiatives from scratch']),
      mkBlock('e5','h2','What we’re looking for'),
      mkBlock('e6','ul',['5+ years of backend engineering experience','Experience with distributed systems at meaningful scale','Excellent written and verbal communication skills']),
      mkBlock('e7','h2','Compensation'),
      mkBlock('e8','p','USD 54,000–72,000/year gross, plus benefits. Final offer depends on experience and location.'),
    ],
  },
};

export const COMMENT_THREADS: Record<string, CommentThread[]> = {
  'job-demo-102:internal':[
    { id:'thr-1', anchorBlock:'b6', status:'open', author:'linh', createdAt:daysAgo(2),
      body:'This job is mostly internal-team facing — do we really need B2B SaaS platform experience as a must-have? I’d suggest preferred.',
      replies:[ { author:'maya', createdAt:daysAgo(2), body:'I want to keep it must-have — the whole team came from B2B SaaS backgrounds and it matters for onboarding speed.' } ] },
    { id:'thr-2', anchorBlock:'b10', status:'resolved', resolvedBy:'alex', resolvedAt:daysAgo(9),
      author:'sam', createdAt:daysAgo(10),
      body:'Confirmed the $7,000/month ceiling with FY26 budget — approved for this req.', replies:[] },
  ],
};

export const SUGGESTIONS: Record<string, Suggestion[]> = {
  'job-demo-102:internal':[
    { id:'sug-seed-1', anchorBlock:'b6', status:'stale', author:'ai', initiatedBy:'maya', createdAt:daysAgo(5),
      instruction:'Make the B2B SaaS requirement easier to verify against a resume.',
      oldText:'Experience building B2B SaaS platforms',
      newText:'2+ years building B2B SaaS platforms, with a named product and your specific contribution',
      reason:'Adds a verifiable evidence bar so screeners can assess this consistently.',
      staleReason:'The surrounding requirement text changed after this suggestion was generated.' },
  ],
};
