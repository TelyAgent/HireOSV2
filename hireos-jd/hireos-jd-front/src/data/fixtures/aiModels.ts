/** AI model catalog, task policies, evaluations and usage. */
import { daysAgo } from "../../lib/format";
import type { AiModel, ModelActivityItem, ModelEval, TaskPolicy, UsageRow } from "../types";

export const MODELS: AiModel[] = [
  { id:'model-a', provider:'Anthropic (via platform gateway)', name:'Claude — Balanced', region:'us', capabilities:['jd_parse','requirement_discovery','quality_review','jd_generate','change_summary'], priceKnown:true, priceIn:'$3.00/1M tok', priceOut:'$15.00/1M tok', p50:'1.8s', p95:'4.1s', accuracy:'94%', status:'enabled' },
  { id:'model-b', provider:'Anthropic (via platform gateway)', name:'Claude — Fast', region:'us', capabilities:['jd_translate','change_summary'], priceKnown:true, priceIn:'$0.80/1M tok', priceOut:'$4.00/1M tok', p50:'0.7s', p95:'1.6s', accuracy:'89%', status:'enabled' },
  { id:'model-c', provider:'Regional Partner Model Co.', name:'Partner Model — APAC', region:'apac', capabilities:['jd_translate'], priceKnown:false, priceIn:'Unknown', priceOut:'Unknown', p50:'2.4s', p95:'6.0s', accuracy:'Not evaluated', status:'disabled', disabledReason:'Pending regional data-policy review.' },
];

export const TASK_POLICIES: Record<string, TaskPolicy> = {
  jd_parse:{ primary:'model-a', fallback:null, preference:'Balanced', budget:'Workspace default', notes:'Inherits platform hard limits: no restricted-field extraction without human confirmation.' },
  requirement_discovery:{ primary:'model-a', fallback:null, preference:'Quality', budget:'Workspace default', notes:'Clarifying questions only — never writes JRP directly.' },
  quality_review:{ primary:'model-a', fallback:null, preference:'Balanced', budget:'Workspace default', notes:'Flags ambiguity/conflict; does not gate submission on its own.' },
  jd_generate:{ primary:'model-a', fallback:null, preference:'Quality', budget:'Workspace default', notes:'External audience always uses the public_eligible field whitelist.' },
  jd_translate:{ primary:'model-b', fallback:'model-c', preference:'Cost', budget:'Workspace default', notes:'APAC partner model disabled pending review — falls back to Claude Fast.' },
  change_summary:{ primary:'model-b', fallback:'model-a', preference:'Latency', budget:'Workspace default', notes:'Used for version-diff summaries in Versions & Impact.' },
};

export const MODEL_EVALS: ModelEval[] = [
  { id:'ev-1', taskType:'jd_generate', model:'model-a', sampleSize:40, accuracy:'94%', cost:'$0.041/doc', p50:'1.8s', p95:'4.1s', failureRate:'1.2%', measuredAt:daysAgo(6), reviewer:'alex' },
  { id:'ev-2', taskType:'quality_review', model:'model-a', sampleSize:25, accuracy:'91%', cost:'$0.018/doc', p50:'1.2s', p95:'3.0s', failureRate:'2.0%', measuredAt:daysAgo(6), reviewer:'alex' },
];

export const USAGE_ROWS: UsageRow[] = [
  { taskType:'jd_generate', estimated:'$18.40', reserved:'$4.10', actual:'$14.02', pending:'$0.28', period:'This month' },
  { taskType:'requirement_discovery', estimated:'$9.10', reserved:'$0.00', actual:'$8.95', pending:'$0.00', period:'This month' },
  { taskType:'quality_review', estimated:'$5.60', reserved:'$0.40', actual:'$5.02', pending:'$0.18', period:'This month' },
  { taskType:'jd_translate', estimated:'$2.20', reserved:'$0.00', actual:'$1.98', pending:'$0.00', period:'This month' },
];

export const MODEL_ACTIVITY: ModelActivityItem[] = [
  { at:daysAgo(6), text:'Task policy for jd_generate published (v4) by Alex Park.' },
  { at:daysAgo(6), text:'Evaluation run completed for jd_generate on 40-sample dataset.' },
  { at:daysAgo(9), text:'Price sync failed for Regional Partner Model Co. — provider does not support automatic price sync.' },
  { at:daysAgo(14), text:'Controlled rollout of Claude — Balanced v2 completed at 100% — no regression detected.' },
];
