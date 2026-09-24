/**
 * Seed fixture data, ported from docs/hireos-assessment-prototype.html's
 * `freshSeed()`. No backend exists yet for this subsystem (hireos-written,
 * PORTS.md reserves 3008) — every page reads from this in-memory data until
 * one is built. IDs, statuses and cross-references are kept exactly as in
 * the prototype so page logic (status badges, filters, evidence links)
 * ports over unchanged.
 */

export const DEMO_CLOCK_BASE = "2026-09-11T08:00:00Z";
export const TZ = "Asia/Shanghai";

export interface CoreCandidate {
  id: string;
  name: string;
  email: string;
  userId: string;
  profileVersion: string;
  profileNote?: string;
}

export interface CoreJob {
  id: string;
  title: string;
  roleVersionId?: string;
  jobRefId?: string | null;
  sourceUrl?: string | null;
  workspaceId: string;
  qualityNote?: string;
  duplicateOf?: string;
}

export interface CoreApplication {
  id: string;
  candidateId: string;
  jobId: string;
  cycleId: string;
  status: string;
}

export interface CoreFile {
  id: string;
  name: string;
  versions: { ver: number; status: string; size: string; checksum: string }[];
}

export const CORE_CANDIDATES: Record<string, CoreCandidate> = {
  core_candidate_a: { id: "core_candidate_a", name: "Alex Morgan", email: "alex.morgan@example.com", userId: "user_candidate_a", profileVersion: "v1" },
  core_candidate_b: { id: "core_candidate_b", name: "Jordan Lee", email: "jordan.lee@example.com", userId: "user_candidate_b", profileVersion: "v1" },
  core_candidate_c: { id: "core_candidate_c", name: "Casey Chen", email: "casey.chen@example.com", userId: "user_candidate_c", profileVersion: "v1" },
  core_candidate_d: { id: "core_candidate_d", name: "Taylor Brooks", email: "taylor.brooks@example.com", userId: "user_candidate_d", profileVersion: "v2", profileNote: "Profile updated to v2 after assessment; scoring still references v1 input." },
  core_candidate_devon: { id: "core_candidate_devon", name: "Devon Ruiz", email: "devon.ruiz@example.com", userId: "user_candidate_devon", profileVersion: "v1" },
  core_candidate_harper: { id: "core_candidate_harper", name: "Harper Diaz", email: "harper.diaz@example.com", userId: "user_candidate_harper", profileVersion: "v1" },
  core_candidate_casey_chan: { id: "core_candidate_casey_chan", name: "Sofia Bianchi", email: "sofia.bianchi@example.com", userId: "user_candidate_casey_chan", profileVersion: "v1" },
  core_candidate_elena: { id: "core_candidate_elena", name: "Elena Cruz", email: "elena.cruz@example.com", userId: "user_candidate_elena", profileVersion: "v1" },
};

export const CORE_JOBS: Record<string, CoreJob> = {
  core_job_fin: { id: "core_job_fin", title: "Finance Operations Analyst", roleVersionId: "core_role_fin_v1", workspaceId: "ws_demo" },
  core_job_crypto1: { id: "core_job_crypto1", title: "Crypto Trading Analyst (Research-Focused)", jobRefId: "1937823", sourceUrl: "https://employer.vietnamworks.com/job/v3/candidates?jobId=1937823", workspaceId: "ws_demo" },
  core_job_juniormarket: { id: "core_job_juniormarket", title: "Junior Market Analyst", jobRefId: "1952124", sourceUrl: "https://employer.vietnamworks.com/job/v3/candidates?jobId=1952124", workspaceId: "ws_demo", qualityNote: "Posting title says \"Junior Market Analyst\" but the role body refers to \"Junior Trader\" throughout — mismatch flagged, not corrected silently." },
  core_job_crypto2: { id: "core_job_crypto2", title: "Crypto Trading Analyst (Research-Focused)", jobRefId: "1985301", sourceUrl: "https://employer.vietnamworks.com/job/v3/candidates?jobId=1985301", workspaceId: "ws_demo", qualityNote: "Identical text to Job ID 1937823 — looks like a repost under a new job ID rather than a distinct role.", duplicateOf: "core_job_crypto1" },
  core_job_eapa: { id: "core_job_eapa", title: "Executive Operations & Personal Assistant To The Founder", jobRefId: "2052573", sourceUrl: "https://employer.vietnamworks.com/job/v3/candidates?jobId=2052573", workspaceId: "ws_demo" },
  core_job_growth: { id: "core_job_growth", title: "Growth Lead — 0-to-1 Growth & Growth Operations", jobRefId: "2058789", sourceUrl: "https://employer.vietnamworks.com/job/v3/candidates?jobId=2058789", workspaceId: "ws_demo" },
  core_job_fd: { id: "core_job_fd", title: "Finance Director — Finance Operations & Governance", jobRefId: "2069485", sourceUrl: "https://employer.vietnamworks.com/job/v3/candidates?jobId=2069485", workspaceId: "ws_demo" },
  core_job_sia1: { id: "core_job_sia1", title: "Strategic Investment Associate — Investment Operations, Portfolio & Entity Management", jobRefId: null, sourceUrl: null, workspaceId: "ws_demo", qualityNote: "No VietnamWorks job link on file — confirm which platform/date this ran on." },
  core_job_pa_ceo: { id: "core_job_pa_ceo", title: "Personal Assistant To President or CEO", jobRefId: null, sourceUrl: null, workspaceId: "ws_demo", qualityNote: "No VietnamWorks job link on file — confirm which platform/date this ran on." },
  core_job_sia2: { id: "core_job_sia2", title: "Strategic Investment Associate", jobRefId: null, sourceUrl: null, workspaceId: "ws_demo", qualityNote: "No VietnamWorks job link on file. Differently-worded second Strategic Investment Associate posting on file — compare against core_job_sia1 to confirm which is the current version." },
  core_job_hrlead: { id: "core_job_hrlead", title: "HR Lead — Vietnam New Business Units", jobRefId: null, sourceUrl: null, workspaceId: "ws_demo", qualityNote: "No VietnamWorks job link on file — this is the posting the current active HR Lead candidate pipeline (27-candidate VietnamWorks batch, Sept 11 2026) is sourced against." },
};

export const CORE_APPLICATIONS: Record<string, CoreApplication> = {
  application_a: { id: "application_a", candidateId: "core_candidate_a", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
  application_b: { id: "application_b", candidateId: "core_candidate_b", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
  application_c: { id: "application_c", candidateId: "core_candidate_c", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
  application_d: { id: "application_d", candidateId: "core_candidate_d", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
  application_devon: { id: "application_devon", candidateId: "core_candidate_devon", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
  application_harper: { id: "application_harper", candidateId: "core_candidate_harper", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
  application_casey_chan: { id: "application_casey_chan", candidateId: "core_candidate_casey_chan", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
  application_elena: { id: "application_elena", candidateId: "core_candidate_elena", jobId: "core_job_fin", cycleId: "cycle_fin_01", status: "active" },
};

export const CORE_FILES: Record<string, CoreFile> = {
  core_file_001: { id: "core_file_001", name: "alex_morgan_submission.zip", versions: [{ ver: 1, status: "ready", size: "2.1 MB", checksum: "a1c9…44f" }] },
  core_file_002: { id: "core_file_002", name: "casey_chen_submission.zip", versions: [{ ver: 1, status: "ready", size: "640 KB", checksum: "9be2…107" }] },
  core_file_003: { id: "core_file_003", name: "taylor_brooks_submission.zip", versions: [{ ver: 1, status: "ready", size: "3.4 MB", checksum: "77aa…9c2" }] },
  core_file_q001: { id: "core_file_q001", name: "FIN-001_case_materials.zip", versions: [{ ver: 1, status: "ready", size: "1.2 MB", checksum: "11de…f02" }] },
  core_file_q002: { id: "core_file_q002", name: "FIN-002_case_materials.zip", versions: [{ ver: 1, status: "ready", size: "980 KB", checksum: "c390…1aa" }] },
  core_file_004: { id: "core_file_004", name: "devon_ruiz_submission.zip", versions: [{ ver: 1, status: "ready", size: "1.8 MB", checksum: "5f21…c3a" }] },
  core_file_005: { id: "core_file_005", name: "harper_diaz_submission.zip", versions: [{ ver: 1, status: "ready", size: "1.5 MB", checksum: "8de0…b76" }] },
};

export const PROJECT = { id: "prj_fin", name: "Finance Operations Hiring", jobId: "core_job_fin", status: "active", requiredCase: "q_fin001", optionalCase: "q_fin002", secondaryRole: "Strategic Investment Associate" };

export interface Competency { name: string; fraction: number }
export interface Question {
  id: string; code: string; title: string; type: string; roles: string[]; competencies: Competency[];
  difficulty: string; estMinutes: number; language: string; version: number;
  status: "published" | "draft_review" | "internal_only" | "concept";
  author: string; favorite: boolean;
  prompt: string; materials: string[]; deliverables: string[];
  /** Every hand-authored bank question has one; an AI-generated question (see AssessmentQuestionDrawer)
   * doesn't get one at creation time — there's no internal answer key to write until someone reviews it. */
  rubricNote?: string;
  usageCount: number; seenByCount: number; pendingFractionIssue?: boolean;
}

export const QUESTIONS: Record<string, Question> = {
  q_fin001: { id: "q_fin001", code: "FIN-001", title: "Finance Operations Practical Case", type: "Written + File", roles: ["Finance Operations Analyst"], competencies: [{ name: "Cashbook and evidence matching", fraction: 0.25 }, { name: "Bank reconciliation", fraction: 0.30 }, { name: "Reimbursements and exceptions", fraction: 0.20 }, { name: "Accountant package", fraction: 0.15 }, { name: "Controls and communication", fraction: 0.10 }], difficulty: "Medium", estMinutes: 90, language: "English", version: 3, status: "published", author: "user_daniel", favorite: true,
    prompt: "You are taking over June 2026 finance operations for EmMonster SG. Opening bank and book cash both stand at SGD 50,000; the attachments contain the full month's bank statement, ledger cash entries, payment requests, invoices, reimbursement claims and account-control notes. Work entirely in SGD and ignore tax. (1) Build a cashbook that matches every bank line to the ledger, a payment request, an invoice or a claim — keep every bank line, even a duplicate payment; never delete a real cash movement. (2) Reconcile the book balance to the bank balance, explaining unbooked items and book misclassifications, and clearly separate cash-timing differences from expense reclassifications. (3) Build a reimbursement tracker that flags duplicate claims, missing receipts and the recovery action each one needs. (4) List every exception with its owner, priority and required documentation, then draft a 250–400 word email to the external accountant. (5) Recommend payment-approval, entity-tagging, file-naming, payroll-access and month-end handover controls.",
    materials: ["bank_statement.json / bank_statement.md", "ledger_export.json / ledger_export.md", "payment_requests.json / payment_requests.md", "reimbursement_claims.json / reimbursement_claims.md", "support_documents.json / support_documents.md", "account_controls.json / account_controls.md"],
    deliverables: ["Cashbook (cashbook.md)", "Bank reconciliation (bank_reconciliation.md)", "Reimbursement tracker (reimbursement_tracker.md)", "Issues & owners log (issues.md)", "External accountant email — English (accountant_email.md)"],
    rubricNote: "Reviewer only — bank rolls SGD 50,000 + 20,000 − 5,000 − 600 − 600 − 12,000 − 300 − 2,700 + 2,000 + 500 − 10,000 − 50 + 20 = SGD 41,270; ledger ends at 35,800. Bridge = +2,000 ABC receipt +500 vendor refund −50 bank fee +20 interest +3,000 mis-recorded audit-payment reversal = +5,470, tying book to bank with zero residual. R01 was paid twice — flag for SGD 600 recovery rather than deleting the bank line; R02 is unapproved and unsupported and must not be booked as an approved reimbursement.",
    usageCount: 14, seenByCount: 6 },
  q_fin002: { id: "q_fin002", code: "FIN-002", title: "Accounting, Reporting & Finance Controls Case", type: "Written + File", roles: ["Finance Operations Analyst", "Finance Manager"], competencies: [{ name: "Accounting Treatment", fraction: 0.40 }, { name: "Monthly Reporting Package", fraction: 0.20 }, { name: "Finance Controls", fraction: 0.25 }, { name: "External Accountant Email", fraction: 0.15 }], difficulty: "Medium", estMinutes: 150, language: "English", version: 2, status: "published", author: "user_john", favorite: false,
    prompt: "As of the 30 June 2026 reporting date (functional and reporting currency SGD), you're handed 11 month-end events already tagged with their as-booked status. This is a simplified accrual-accounting exercise — tax is out of scope. (1) For all 11 events, state the original treatment, the correcting entry, the balance-sheet/P&L impact, your basis, any missing evidence, and whether it can be booked yet. (2) Build a monthly amortisation schedule for prepaid rent and software. (3) For the two legal entities, set out the AWS entries and how the intercompany balances should be matched. (4) Design the external accountant's month-end package. (5) Propose five controls and write an English accounting email consistent with your booked entries.",
    materials: ["month_end_events.json / month_end_events.md", "accounting_policy.json / accounting_policy.md"],
    deliverables: ["Accounting treatment log (accounting_treatment.md)", "Prepaid amortisation schedule (prepaid_schedule.md)", "Monthly close package outline (monthly_package.md)", "Five-control memo (controls.md)", "External accountant email — English (accountant_email.md)"],
    rubricNote: "Reviewer only — internal answer key walks all 11 month-end events to a target treatment; watch for candidates double-booking cash already recorded, and AWS intercompany entries matched consistently across both entities' books.",
    usageCount: 6, seenByCount: 2 },
  q_fin004: { id: "q_fin004", code: "FIN-004", title: "Cap Table & Investment Data Room Review Case", type: "Written + File", roles: ["Strategic Investment Associate"], competencies: [{ name: "FD reconstruction and calculations", fraction: 0.30 }, { name: "Evidence and document index", fraction: 0.25 }, { name: "Risk prioritisation", fraction: 0.20 }, { name: "Rights and version control", fraction: 0.15 }, { name: "Founder communication", fraction: 0.10 }], difficulty: "Hard", estMinutes: 180, language: "English", version: 1, status: "published", author: "user_daniel", favorite: false,
    prompt: "Aurora's historical cap tables conflict with each other (all shares and amounts are fictional). Reconstruct the fully-diluted cap table as of post-Seed, post-Series A and post-Series B. Separately show your draft/model baseline versus what is actually confirmed as issued. Build a document index against every source_id, output a risk register, and write a two-page-maximum Founder Summary.",
    materials: ["data_room_documents.json / data_room_documents.md", "cap_table_versions.json / cap_table_versions.md", "handover_email.json / handover_email.md"],
    deliverables: ["Fully-diluted cap table (cap_table.md)", "Document index (document_index.md)", "Risk register (risk_register.md)", "Side-letter rights tracker (rights_tracker.md)", "Founder Summary — 2 pages max (founder_summary.md)"],
    rubricNote: "Reviewer only — internal answer key treats the Eastlink and Helios rows as unresolved until the underlying instrument is confirmed.",
    usageCount: 5, seenByCount: 1 },
  q_fin008: { id: "q_fin008", code: "FIN-008", title: "Private Markets Portfolio NAV & Valuation Case (SIA-lite)", type: "Written + File", roles: ["Strategic Investment Associate", "Finance Operations Analyst", "Finance Director"], competencies: [{ name: "Accounting classification", fraction: 0.15 }, { name: "Fund NAV and valuation", fraction: 0.20 }, { name: "Direct valuation", fraction: 0.20 }, { name: "Journals and FX", fraction: 0.15 }, { name: "Audit evidence", fraction: 0.10 }, { name: "Founder communication", fraction: 0.10 }], difficulty: "Hard", estMinutes: 300, language: "English", version: 2, status: "draft_review", author: "user_john", favorite: true,
    prompt: "Reporting period end is 30 June 2026 for a Singapore investment entity. This is the SIA-lite variant: HR has waived Task 4 (the SFRS(I) accounting/regulatory memo), and dimension weights need to be rebalanced before this version can be published. Roll forward period-end NAV for five funds, analyse four direct investments, build a portfolio master, prepare an audit evidence matrix, and output a two-page-maximum Founder/Board Summary.",
    materials: ["fund_reports.json / fund_reports.md", "direct_events.json / direct_events.md", "fx_and_cash.json / fx_and_cash.md", "entity_background.json / entity_background.md", "evidence_inventory.json / evidence_inventory.md"],
    deliverables: ["Portfolio master (portfolio_master.md)", "Valuation scenarios — base/low/high (valuation_scenarios.md)", "Audit evidence matrix (audit_evidence.md)", "Founder/Board Summary — 2 pages max (founder_summary.md)"],
    rubricNote: "Reviewer only — pending redistribution of competency weights before publish: the SIA-lite variant drops the SFRS(I) accounting/regulatory memo (Task 4), so \"Regulatory applicability\" (10%) has been removed and still needs its weight redistributed across the remaining six dimensions.",
    usageCount: 9, seenByCount: 3, pendingFractionIssue: true },
  q_fin003: { id: "q_fin003", code: "FIN-003", title: "Interview Guide — Self-Correction & Consistency Follow-up", type: "Internal guide", roles: ["Finance Operations Analyst"], competencies: [], difficulty: "—", estMinutes: 0, language: "English", version: 1, status: "internal_only", author: "user_daniel", favorite: false,
    prompt: "(Internal-only interview guide for reviewers running a self-correction follow-up with a fictional demo candidate — not a scored, sendable question.) Candidate reads a reconstructed mock revised submission for 5 minutes, then a 30–35 minute conversation covers self-correction, consistency and live follow-up.",
    materials: ["mock_revised_submission.json / mock_revised_submission.md — reconstructed anonymous answer for calibration, not the candidate's real submission"], deliverables: [],
    rubricNote: "Internal only. Interviewer notes use templates correction_log.md and interview_notes.md. Scoring anchors (Self-correction 30% / Accounting logic 30% / Transfer and consistency 25% / Clear explanation 15%) live in this guide for calibration, but this item is never published as a candidate-facing question.", usageCount: 0, seenByCount: 0 },
  q_fin009: { id: "q_fin009", code: "FIN-009", title: "Offshore Entity Maintenance, Deregistration & Cost-Saving Case (concept)", type: "Written", roles: ["Finance Director", "Strategic Investment Associate"], competencies: [{ name: "Entity inventory", fraction: 0.15 }, { name: "Jurisdiction research", fraction: 0.20 }, { name: "Internal/external split", fraction: 0.20 }, { name: "Cost saving logic", fraction: 0.15 }, { name: "Risk judgment", fraction: 0.15 }, { name: "SOP and project plan", fraction: 0.10 }, { name: "Founder communication", fraction: 0.05 }], difficulty: "—", estMinutes: 0, language: "English", version: 1, status: "concept", author: "user_john", favorite: false,
    prompt: "(Concept only — rubric dimensions and weights are drafted from an HR intake call; the full task brief, attachments and materials are not yet written.) The group has seven mock legal entities with high intermediary costs and incomplete handover files; the candidate recommends keep / reduce-cost / investigate / wind-down-or-liquidate treatment per entity.",
    materials: ["(planned) entity_inventory.json", "(planned) vendor_quotes.json", "(planned) handover_notes.json", "(planned) research_log_seed.json"],
    deliverables: ["(planned) Entity action tracker (entity_tracker.md)", "(planned) Internal/external work-split matrix (work_split.md)", "(planned) Jurisdiction research matrix (research_matrix.md)", "(planned) Cost/saving plan (cost_plan.md)", "(planned) 30/60/90-day plan (plan_90days.md)", "(planned) Maintenance SOP (SOP.md)"],
    rubricNote: "Dimension weights drafted from an HR intake call. Prompt, attachments and rubric answer key still need to be drafted before this can move to draft_review.", usageCount: 0, seenByCount: 0 },
  q_fin010: { id: "q_fin010", code: "FIN-010", title: "AI-Enabled Finance & Back Office Automation Case", type: "Written + File", roles: ["Finance Operations Analyst", "Finance Operations Lead"], competencies: [{ name: "Process redesign", fraction: 0.20 }, { name: "Agent and data design", fraction: 0.20 }, { name: "Controls and failure handling", fraction: 0.25 }, { name: "Dry-run and testing", fraction: 0.20 }, { name: "Roadmap and economics", fraction: 0.15 }], difficulty: "Hard", estMinutes: 180, language: "English", version: 1, status: "published", author: "user_daniel", favorite: false,
    prompt: "Today the team manually processes roughly 300 invoices, 100 reimbursements, a 20-person payroll and 600 bank lines a month; month-end close takes 8 business days. Diagram the current and proposed process, define the automation agent's schema/controls, dry-run all 8 sample events, give a 30/60/90-day rollout roadmap, and deliver a design memo, workflow diagram, run log and test matrix.",
    materials: ["event_queue.json / event_queue.md", "document_texts.json / document_texts.md", "operating_policy.json / operating_policy.md", "baseline_metrics.json / baseline_metrics.md"],
    deliverables: ["Design memo (design_memo.md)", "Current/proposed workflow diagram (workflow.md)", "Agent contract — schema & controls (agent_contract.md)", "Dry-run log for all 8 events (dry_run.md)", "Test matrix (test_matrix.md)", "30/60/90 roadmap & business case (roadmap.md, business_case.md)"],
    rubricNote: "Reviewer only — internal answer key expects the candidate to route the suspicious document text to hold-for-review rather than auto-processing it, and to require human approval before any payroll-adjacent action regardless of confidence score.",
    usageCount: 0, seenByCount: 0 },
  q_fin006: { id: "q_fin006", code: "FIN-006", title: "Finance Director Fit & English Communication Interview", type: "Structured interview", roles: ["Finance Director"], competencies: [{ name: "Ownership and prioritisation", fraction: 0.35 }, { name: "Cross-functional coordination", fraction: 0.25 }, { name: "English stakeholder communication", fraction: 0.25 }, { name: "Learning ability", fraction: 0.15 }], difficulty: "Medium", estMinutes: 35, language: "English", version: 1, status: "published", author: "user_morgan", favorite: false,
    prompt: "This is a structured verbal interview — no financial model is required. Candidate introduces their experience in English, discusses juggling priorities at an early-stage startup, handling abrupt founder priority changes, and their appetite for learning AI/agent tooling. HR separately verifies compensation/logistics — not scored.",
    materials: ["mock_profile.json / mock_profile.md — anonymised, fictional candidate background"],
    deliverables: ["Interview scorecard (interview_scorecard.md)", "Hiring recommendation (recommendation.md)", "Terms checklist — logistics only, not scored (terms_checklist.md)"],
    rubricNote: "Reviewer only — HR's terms_checklist section must stay out of the four scored competencies; only sections 1–4 of the conversation feed the rubric.",
    usageCount: 0, seenByCount: 0 },
  q_navext01: { id: "q_navext01", code: "NAV-EXT-01", title: "Northstar Fund — NAV Roll-Forward, SAFE Conversion & LP Accounts", type: "Written + File", roles: ["Finance Director", "Fund Accountant"], competencies: [{ name: "Investment and SAFE model", fraction: 0.30 }, { name: "Cash/NAV reconciliation", fraction: 0.25 }, { name: "Journals and gain split", fraction: 0.20 }, { name: "LP accounts and metrics", fraction: 0.15 }, { name: "Board and audit communication", fraction: 0.10 }], difficulty: "Hard", estMinutes: 240, language: "English", version: 1, status: "draft_review", author: "user_daniel", favorite: false,
    prompt: "This case reconstructs an internal review note about a Northstar fund model submission; the original brief and files were never recovered, so this is an independently rebuilt variant. Model a mock USD fund through Q2: build an investment schedule, process a SAFE conversion, a secondary sale and a wind-down event, build LP capital accounts, and output an accounting memo and Board Summary.",
    materials: ["opening_positions.json / opening_positions.md", "quarter_events.json / quarter_events.md", "closing_evidence.json / closing_evidence.md", "LP_register.json / LP_register.md"],
    deliverables: ["Investment schedule (investment_schedule.md)", "SAFE conversion workings (SAFE.md)", "NAV bridge (NAV_bridge.md)", "Quarterly journals (journals.md)", "LP capital accounts & metrics (LP_accounts.md)", "Board Summary (board_summary.md)"],
    rubricNote: "Reviewer only — this is a reconstructed variant built to keep the rubric internally consistent; do not present these numbers as historical ground truth. Candidates should not compute an IRR without a dated cash-flow series.",
    usageCount: 0, seenByCount: 0 },
};

export interface Round { id: string; position: number; title: string; planItemIds: string[]; releaseCondition: string; dependsOnRoundIds?: string[]; deadlineAt: string | null; status: string }
export interface Case {
  id: string; candidateId: string; applicationId: string; label: string; planItems: string[]; status: string;
  ownership: { hrOwner: string | null; hiringManager: string | null; reviewAssignee: string | null };
  roundMode: "single" | "multiple"; rounds: Round[];
  /** Set when an assessment question is added to a case after its result was already released —
   * flags the candidate's task as needing another look (pending_submission) until the new round
   * clears. Only ever written by the "add assessment question" drawer. */
  supplementalPending?: boolean;
}

export const CASES: Record<string, Case> = {
  case_a: { id: "case_a", candidateId: "core_candidate_a", applicationId: "application_a", label: "Alex Morgan — Finance Operations Analyst", planItems: ["pi_a1"], status: "evaluated", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: "user_daniel" }, roundMode: "single", rounds: [{ id: "round_case_a_1", position: 1, title: "Round 1", planItemIds: ["pi_a1"], releaseCondition: "manual", deadlineAt: "2026-08-20T23:59:00Z", status: "completed" }] },
  case_b: { id: "case_b", candidateId: "core_candidate_b", applicationId: "application_b", label: "Jordan Lee — Finance Operations Analyst", planItems: ["pi_b1"], status: "awaiting_submission", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: null }, roundMode: "single", rounds: [{ id: "round_case_b_1", position: 1, title: "Round 1", planItemIds: ["pi_b1"], releaseCondition: "manual", deadlineAt: "2026-09-18T23:59:00Z", status: "invited" }] },
  case_c: { id: "case_c", candidateId: "core_candidate_c", applicationId: "application_c", label: "Casey Chen — Finance Operations Analyst", planItems: ["pi_c1"], status: "issue_open", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: null }, roundMode: "single", rounds: [{ id: "round_case_c_1", position: 1, title: "Round 1", planItemIds: ["pi_c1"], releaseCondition: "manual", deadlineAt: "2026-09-12T23:59:00Z", status: "in_progress" }] },
  case_d: { id: "case_d", candidateId: "core_candidate_d", applicationId: "application_d", label: "Taylor Brooks — Finance Operations Analyst", planItems: ["pi_d1"], status: "review_pending", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: "user_daniel" }, roundMode: "single", rounds: [{ id: "round_case_d_1", position: 1, title: "Round 1", planItemIds: ["pi_d1"], releaseCondition: "manual", deadlineAt: "2026-09-10T23:59:00Z", status: "submitted" }] },
  case_devon: { id: "case_devon", candidateId: "core_candidate_devon", applicationId: "application_devon", label: "Devon Ruiz — Finance Operations Analyst", planItems: ["pi_devon1"], status: "released", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: "user_daniel" }, roundMode: "single", rounds: [{ id: "round_case_devon_1", position: 1, title: "Round 1", planItemIds: ["pi_devon1"], releaseCondition: "manual", deadlineAt: "2026-08-10T23:59:00Z", status: "completed" }] },
  case_harper: { id: "case_harper", candidateId: "core_candidate_harper", applicationId: "application_harper", label: "Harper Diaz — Finance Operations Analyst", planItems: ["pi_harper1", "pi_harper2"], status: "awaiting_submission", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: "user_john" }, roundMode: "multiple", rounds: [
    { id: "round_case_harper_1", position: 1, title: "Round 1 — FIN-001 (required)", planItemIds: ["pi_harper1"], releaseCondition: "manual", deadlineAt: "2026-09-05T23:59:00Z", status: "completed" },
    { id: "round_case_harper_2", position: 2, title: "Round 2 — FIN-002 (optional follow-up)", planItemIds: ["pi_harper2"], releaseCondition: "after_previous_review", dependsOnRoundIds: ["round_case_harper_1"], deadlineAt: "2026-09-16T23:59:00Z", status: "invited" },
  ] },
  case_casey_chan: { id: "case_casey_chan", candidateId: "core_candidate_casey_chan", applicationId: "application_casey_chan", label: "Sofia Bianchi — Finance Operations Analyst", planItems: [], status: "linked", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: null }, roundMode: "single", rounds: [{ id: "round_case_casey_chan_1", position: 1, title: "Round 1", planItemIds: [], releaseCondition: "manual", deadlineAt: null, status: "planned" }] },
  case_elena: { id: "case_elena", candidateId: "core_candidate_elena", applicationId: "application_elena", label: "Elena Cruz — Finance Operations Analyst", planItems: ["pi_elena1"], status: "linked", ownership: { hrOwner: "user_john", hiringManager: "user_daniel", reviewAssignee: null }, roundMode: "single", rounds: [{ id: "round_case_elena_1", position: 1, title: "Round 1", planItemIds: ["pi_elena1"], releaseCondition: "manual", deadlineAt: null, status: "planned" }] },
};

// ScreeningSelectionContext: candidates Screening already matched/scored for this role,
// handed off for HR/HM to pick from — not yet linked to any Assessment Case. Selecting
// one reuses that screening artifact rather than re-uploading a résumé.
export interface ScreeningPoolEntry { candidateId: string; name: string; email: string; jobId: string; screeningResultRef: string; screeningArtifactRef: string; recommendation: string; screeningScore: number; screenedAt: string }
export const SCREENING_POOL: ScreeningPoolEntry[] = [
  { candidateId: "screen_cand_nina", name: "Nina Okafor", email: "nina.okafor@example.com", jobId: "core_job_fin", screeningResultRef: "screening_result_nina", screeningArtifactRef: "file_screening_nina_v1", recommendation: "Strong match", screeningScore: 88, screenedAt: "2026-09-08T09:00:00Z" },
  { candidateId: "screen_cand_marcus", name: "Marcus Webb", email: "marcus.webb@example.com", jobId: "core_job_fin", screeningResultRef: "screening_result_marcus", screeningArtifactRef: "file_screening_marcus_v1", recommendation: "Possible match", screeningScore: 71, screenedAt: "2026-09-09T14:30:00Z" },
];

export interface PlanItem {
  id: string; caseId: string; questionId: string; kind: "required" | "optional"; status: string;
  /** Per-candidate override of the question's prompt text — set by the "Edit question" drawer (a
   * later phase); never changes the shared Question Bank preset. */
  customPrompt?: string | null;
}
export const PLANS: Record<string, PlanItem> = {
  pi_a1: { id: "pi_a1", caseId: "case_a", questionId: "q_fin001", kind: "required", status: "completed" },
  pi_b1: { id: "pi_b1", caseId: "case_b", questionId: "q_fin001", kind: "required", status: "awaiting_submission" },
  pi_c1: { id: "pi_c1", caseId: "case_c", questionId: "q_fin001", kind: "required", status: "issue_open" },
  pi_d1: { id: "pi_d1", caseId: "case_d", questionId: "q_fin001", kind: "required", status: "submitted" },
  pi_devon1: { id: "pi_devon1", caseId: "case_devon", questionId: "q_fin001", kind: "required", status: "completed" },
  pi_harper1: { id: "pi_harper1", caseId: "case_harper", questionId: "q_fin001", kind: "required", status: "completed" },
  pi_harper2: { id: "pi_harper2", caseId: "case_harper", questionId: "q_fin002", kind: "optional", status: "awaiting_submission" },
  pi_elena1: { id: "pi_elena1", caseId: "case_elena", questionId: "q_fin001", kind: "required", status: "planned" },
};

export interface Invitation {
  id: string; caseId: string; questionIds: string[]; mode: "timed" | "deadline_only"; durationMin?: number; deadline: string;
  status: string; acceptedAt: string | null; startedAt: string | null; disclosurePolicy: string; note?: string;
  /** Set only when this invitation was created via hireos-written-backend's real /cases/:id/invitations
   * endpoint — the public candidate-facing form at /apply/:token is only reachable for these. */
  token?: string;
}
export const INVITATIONS: Record<string, Invitation> = {
  inv_a: { id: "inv_a", caseId: "case_a", questionIds: ["q_fin001"], mode: "timed", durationMin: 90, deadline: "2026-08-20T23:59:00Z", status: "submitted", acceptedAt: "2026-08-14T09:12:00Z", startedAt: "2026-08-14T09:15:00Z", disclosurePolicy: "score_and_summary" },
  inv_b: { id: "inv_b", caseId: "case_b", questionIds: ["q_fin001"], mode: "deadline_only", deadline: "2026-09-18T23:59:00Z", status: "accepted", acceptedAt: "2026-09-08T14:02:00Z", startedAt: null, disclosurePolicy: "score_and_summary" },
  inv_c: { id: "inv_c", caseId: "case_c", questionIds: ["q_fin001"], mode: "timed", durationMin: 90, deadline: "2026-09-12T23:59:00Z", status: "started", acceptedAt: "2026-09-09T10:00:00Z", startedAt: "2026-09-09T10:04:00Z", disclosurePolicy: "summary_only" },
  inv_d: { id: "inv_d", caseId: "case_d", questionIds: ["q_fin001"], mode: "timed", durationMin: 90, deadline: "2026-09-10T23:59:00Z", status: "submitted", acceptedAt: "2026-09-05T08:30:00Z", startedAt: "2026-09-05T08:34:00Z", disclosurePolicy: "score_and_summary" },
  inv_devon: { id: "inv_devon", caseId: "case_devon", questionIds: ["q_fin001"], mode: "timed", durationMin: 90, deadline: "2026-08-10T23:59:00Z", status: "submitted", acceptedAt: "2026-08-04T09:00:00Z", startedAt: "2026-08-04T09:05:00Z", disclosurePolicy: "score_and_summary" },
  inv_harper: { id: "inv_harper", caseId: "case_harper", questionIds: ["q_fin001", "q_fin002"], mode: "deadline_only", deadline: "2026-09-16T23:59:00Z", status: "accepted", acceptedAt: "2026-09-01T08:00:00Z", startedAt: "2026-09-01T08:10:00Z", disclosurePolicy: "score_and_summary", note: "FIN-001 (required) submitted and published; FIN-002 (optional) sent as a follow-up before the interview decision — not yet started." },
};

export interface Attempt { id: string; caseId: string; questionId: string; round: number; status: string; submittedAt?: string; fileRef: string; receivedAt: string; processedAt?: string; missing?: string[] }
export const ATTEMPTS: Record<string, Attempt> = {
  att_a: { id: "att_a", caseId: "case_a", questionId: "q_fin001", round: 1, status: "submitted", submittedAt: "2026-08-14T10:41:00Z", fileRef: "core_file_001", receivedAt: "2026-08-14T10:38:00Z", processedAt: "2026-08-14T10:41:00Z" },
  att_c: { id: "att_c", caseId: "case_c", questionId: "q_fin001", round: 1, status: "incomplete", fileRef: "core_file_002", receivedAt: "2026-09-10T16:20:00Z", missing: ["Bank reconciliation (bank_reconciliation.md)"] },
  att_d: { id: "att_d", caseId: "case_d", questionId: "q_fin001", round: 1, status: "submitted", submittedAt: "2026-09-09T19:05:00Z", fileRef: "core_file_003", receivedAt: "2026-09-09T19:02:00Z", processedAt: "2026-09-09T19:05:00Z" },
  att_devon: { id: "att_devon", caseId: "case_devon", questionId: "q_fin001", round: 1, status: "submitted", submittedAt: "2026-08-05T14:20:00Z", fileRef: "core_file_004", receivedAt: "2026-08-05T14:15:00Z", processedAt: "2026-08-05T14:20:00Z" },
  att_harper: { id: "att_harper", caseId: "case_harper", questionId: "q_fin001", round: 1, status: "submitted", submittedAt: "2026-09-02T11:30:00Z", fileRef: "core_file_005", receivedAt: "2026-09-02T11:25:00Z", processedAt: "2026-09-02T11:30:00Z" },
};

export interface Criterion { name: string; max: number; ai: number; human: number | null; confidence: string; coverage: string; overridden?: boolean; overrideReason?: string; evidence: string; source: string }
export interface Evaluation { id: string; attemptId: string; status: "ai_draft" | "final"; finalizedBy: string | null; finalizedAt: string | null; criteria: Criterion[] }
export const EVALUATIONS: Record<string, Evaluation> = {
  eval_case_a: { id: "eval_case_a", attemptId: "att_a", status: "final", finalizedBy: "user_daniel", finalizedAt: "2026-08-18T11:00:00Z", criteria: [
    { name: "Cashbook and evidence matching", max: 25, ai: 18, human: 20, confidence: "High", coverage: "Full", overridden: true, overrideReason: "All 12 bank lines matched correctly, including both audit-fee cash movements; AI under-credited the ABC receipt treatment.", evidence: "“…treats the SGD 2,000 ABC receipt as unresolved-source cash pending entity confirmation rather than booking it to revenue…”", source: "Cashbook, row 4" },
    { name: "Bank reconciliation", max: 30, ai: 24, human: 24, confidence: "High", coverage: "Full", overridden: false, evidence: "“…bank rolls to SGD 41,270; the +2,000 ABC, +500 vendor refund, −50 fee, +20 interest and +3,000 audit-fee reversal bridge ties book to bank with zero residual…”", source: "Bank reconciliation, p.1" },
    { name: "Reimbursements and exceptions", max: 20, ai: 13, human: 10, confidence: "Medium", coverage: "Full", overridden: true, overrideReason: "Correctly flagged R01 as a duplicate payment needing SGD 600 recovery, but booked R02 as approved without supporting evidence — scored down below the AI draft for the R02 miss.", evidence: "“…R01 appears twice in the bank statement; recommend recovery of SGD 600 rather than reversing the bank line…”", source: "Reimbursement tracker, R01" },
    { name: "Accountant package", max: 15, ai: 11, human: 11, confidence: "High", coverage: "Full", overridden: false, evidence: "Email is 320 words, opens with the SGD 41,270 reconciled balance and lists three open items for the accountant.", source: "Accountant email" },
    { name: "Controls and communication", max: 10, ai: 6, human: 5, confidence: "Medium", coverage: "Partial", overridden: true, overrideReason: "Maker-checker recommendation was generic and didn't reference the payroll-access gap raised in account_controls.md; scored below the AI draft.", evidence: "“…recommend a second approver on all payments above SGD 1,000…”", source: "Issues log" },
  ] },
  eval_case_d: { id: "eval_case_d", attemptId: "att_d", status: "ai_draft", finalizedBy: null, finalizedAt: null, criteria: [
    { name: "Cashbook and evidence matching", max: 25, ai: 23, human: null, confidence: "High", coverage: "Full", evidence: "“…all 12 cashbook lines matched to ledger, payment request, invoice or claim, including the SGD 500 vendor refund…”", source: "Cashbook, row 9" },
    { name: "Bank reconciliation", max: 30, ai: 27, human: null, confidence: "High", coverage: "Full", evidence: "“…bank balance of SGD 41,270 reconciled to the adjusted book balance of 41,270 with zero residual…”", source: "Bank reconciliation, p.1" },
    { name: "Reimbursements and exceptions", max: 20, ai: 16, human: null, confidence: "Medium", coverage: "Full", evidence: "“…R01 flagged as a duplicate payment; recommend recovering SGD 600 rather than deleting the bank line…”", source: "Reimbursement tracker, R01" },
    { name: "Accountant package", max: 15, ai: 10, human: null, confidence: "Medium", coverage: "Partial", evidence: "Email covers the reconciled balance but omits the ABC receipt's unresolved-source status.", source: "Accountant email" },
    { name: "Controls and communication", max: 10, ai: 4, human: null, confidence: "Low", coverage: "Partial", evidence: "Controls section lists only file-naming; payment-approval and payroll-access controls are not addressed.", source: "Issues log" },
  ] },
  eval_case_devon: { id: "eval_case_devon", attemptId: "att_devon", status: "final", finalizedBy: "user_daniel", finalizedAt: "2026-08-10T08:30:00Z", criteria: [
    { name: "Cashbook and evidence matching", max: 25, ai: 20, human: 22, confidence: "High", coverage: "Full", overridden: true, overrideReason: "All 12 lines matched with source_id references; AI missed crediting the explicit suspense treatment on the unresolved ABC receipt.", evidence: "“…books SGD 2,000 ABC receipt to a suspense account pending entity confirmation, cites source_id BS-07…”", source: "Cashbook, row 4" },
    { name: "Bank reconciliation", max: 30, ai: 25, human: 26, confidence: "High", coverage: "Full", overridden: true, overrideReason: "Bridge to SGD 41,270 is fully shown step by step; rounded up half a point for showing the residual check explicitly.", evidence: "“…bank 41,270 = book 35,800 + 5,470 bridge; residual = 0…”", source: "Bank reconciliation, p.1" },
    { name: "Reimbursements and exceptions", max: 20, ai: 17, human: 15, confidence: "Medium", coverage: "Full", overridden: true, overrideReason: "Correctly recovered R01's SGD 600 duplicate, but recommendation for R02 was vague about who owns follow-up — scored below the AI draft.", evidence: "“…R01 duplicate confirmed against bank lines 3 and 9; recommend SGD 600 recovery…”", source: "Reimbursement tracker, R01" },
    { name: "Accountant package", max: 15, ai: 11, human: 10, confidence: "High", coverage: "Full", overridden: true, overrideReason: "Email is well organized but runs to 410 words, over the requested 250–400 word range.", evidence: "Email lists three open items and the reconciled balance up front.", source: "Accountant email" },
    { name: "Controls and communication", max: 10, ai: 6, human: 5, confidence: "Medium", coverage: "Full", overridden: true, overrideReason: "Good payment-approval proposal but no mention of payroll-access restriction.", evidence: "“…recommend dual approval above SGD 1,000 and monthly file-naming audit…”", source: "Issues log" },
  ] },
  eval_case_harper: { id: "eval_case_harper", attemptId: "att_harper", status: "final", finalizedBy: "user_john", finalizedAt: "2026-09-04T09:30:00Z", criteria: [
    { name: "Cashbook and evidence matching", max: 25, ai: 15, human: 16, confidence: "Medium", coverage: "Full", overridden: true, overrideReason: "9 of 12 lines matched correctly; three lines missing a source_id reference back to the ledger.", evidence: "“…SGD 20,000 draw and SGD 12,000 payment matched to ledger, but three smaller lines left unlabeled…”", source: "Cashbook, row 7" },
    { name: "Bank reconciliation", max: 30, ai: 19, human: 20, confidence: "Medium", coverage: "Full", overridden: true, overrideReason: "Reaches the correct SGD 41,270 balance but the bridge shows the audit-fee reversal as a plug rather than explaining it.", evidence: "“…adjusted balance 41,270; audit reversal included as a balancing entry…”", source: "Bank reconciliation, p.1" },
    { name: "Reimbursements and exceptions", max: 20, ai: 11, human: 10, confidence: "Medium", coverage: "Partial", overridden: true, overrideReason: "Flagged R01 as unusual but did not conclude it was a duplicate payment needing recovery.", evidence: "“…R01 appears twice; recommend follow-up with the vendor…”", source: "Reimbursement tracker, R01" },
    { name: "Accountant package", max: 15, ai: 9, human: 8, confidence: "Medium", coverage: "Partial", overridden: true, overrideReason: "Covers the reconciled balance but omits the unresolved ABC receipt from the open-items list.", evidence: "Email lists two of three open items for the accountant.", source: "Accountant email" },
    { name: "Controls and communication", max: 10, ai: 5, human: 4, confidence: "Low", coverage: "Partial", overridden: true, overrideReason: "Controls section is a short generic list without reference to this month's actual exceptions.", evidence: "“…recommend standard segregation of duties…”", source: "Issues log" },
  ] },
};

export interface Result { id: string; caseId: string; evaluationId: string; overall: number; status: string; releaseId: string | null }
export const RESULTS: Record<string, Result> = {
  result_a: { id: "result_a", caseId: "case_a", evaluationId: "eval_case_a", overall: 70, status: "final_not_released", releaseId: null },
  result_devon: { id: "result_devon", caseId: "case_devon", evaluationId: "eval_case_devon", overall: 78, status: "published", releaseId: "rel_case_devon" },
  result_harper: { id: "result_harper", caseId: "case_harper", evaluationId: "eval_case_harper", overall: 58, status: "published", releaseId: "rel_case_harper" },
};

export interface Release {
  id: string; caseId: string; overall: number; showScore: boolean; outcomeText: string; feedbackText: string; nextStepText: string; publishedAt: string;
  /** Set once "Request revision" is confirmed — mirrors the prototype's release.nextAction. */
  nextAction?: "revision";
}
export const RELEASES: Record<string, Release> = {
  rel_case_devon: { id: "rel_case_devon", caseId: "case_devon", overall: 78, showScore: true, outcomeText: "Strong performance on this assessment.", feedbackText: "Clear structure; full bridge shown to the reconciled bank balance with one gap in the reimbursement follow-up recommendation.", nextStepText: "HR will follow up with next steps.", publishedAt: "2026-08-10T09:00:00Z" },
  rel_case_harper: { id: "rel_case_harper", caseId: "case_harper", overall: 58, showScore: true, outcomeText: "Below the bar for this role on this assessment.", feedbackText: "Reached the correct reconciled balance but missed the duplicate-payment recovery and left one open item out of the accountant email.", nextStepText: "HR will follow up with next steps — an optional FIN-002 case has been sent as an additional data point before a final decision.", publishedAt: "2026-09-04T10:00:00Z" },
};

export interface Comparison { id: string; caseIds: string[]; mode: string; createdAt: string; note: string }
export const COMPARISONS: Record<string, Comparison> = {
  cmp_1: { id: "cmp_1", caseIds: ["case_a", "case_d"], mode: "current_summary", createdAt: "2026-09-11T07:00:00Z", note: "Snapshot may go stale once new results are finalized." },
};

// A revision round requested after a Release (see ReleasePage's "Request revision" flow).
// Empty in the seed — none of the demo cases has an open revision yet; RevisionPage
// handles the "not yet requested" state explicitly.
export interface Revision { id: string; caseId: string; round: number; status: string; acceptedAt: string | null; revisionHint?: string }
export const REVISIONS: Record<string, Revision> = {};

export interface Mail { id: string; from: string; subject: string; receivedAt: string; authStatus: string; threadStatus: string; matchReason: string; classification: string; caseId: string | null; attachments: string[]; missing?: string[] }
export const MAIL: Record<string, Mail> = {
  mail_1: { id: "mail_1", from: "alex.morgan@example.com", subject: "Re: FIN-001 — EmMonster SG Reconciliation (Round 1)", receivedAt: "2026-08-14T10:38:00Z", authStatus: "aligned_pass", threadStatus: "Matched by reply thread", matchReason: "Matched by reply thread", classification: "submitted", caseId: "case_a", attachments: ["bank_reconciliation.pdf", "cashbook.xlsx", "reimbursement_tracker.xlsx"] },
  mail_2: { id: "mail_2", from: "casey.chen@example.com", subject: "Re: FIN-001 — EmMonster SG Reconciliation (Round 1)", receivedAt: "2026-09-10T16:20:00Z", authStatus: "aligned_pass", threadStatus: "Matched by reply thread", matchReason: "Matched by reply thread", classification: "incomplete", caseId: "case_c", attachments: ["cashbook.xlsx"], missing: ["Bank reconciliation (bank_reconciliation.md)"] },
  mail_3: { id: "mail_3", from: "jordan.lee@example.com", subject: "Question about the assessment deadline", receivedAt: "2026-09-09T09:15:00Z", authStatus: "aligned_pass", threadStatus: "More than one assignment found", matchReason: "More than one assignment found", classification: "needs_confirmation", caseId: "case_b", attachments: [] },
  mail_4: { id: "mail_4", from: "unknown.sender@example.com", subject: "invoice_macro_enabled.xlsm", receivedAt: "2026-09-11T06:40:00Z", authStatus: "failed", threadStatus: "No thread match — quarantined", matchReason: "Sender authentication failed; macro-enabled attachment", classification: "quarantined", caseId: null, attachments: ["invoice_macro_enabled.xlsm"] },
};

export interface Task { id: string; title: string; type: string; assignee: string | null; queue?: string; status: string; waitingReason?: string; waitingUntil?: string; dueAt: string; link: string; sourceRef: string }
export const TASKS: Record<string, Task> = {
  t1: { id: "t1", title: "Publish Alex Morgan's result", type: "result_release", assignee: "user_john", status: "completed", dueAt: "2026-09-11T10:00:00Z", link: "/results/case_a/release", sourceRef: "case_a" },
  t2: { id: "t2", title: "Review Taylor Brooks' AI draft evaluation", type: "evaluation_review", assignee: "user_daniel", status: "open", dueAt: "2026-09-11T15:00:00Z", link: "/attempts/att_d/review", sourceRef: "case_d" },
  t3: { id: "t3", title: "Casey Chen — missing required deliverable", type: "submission_issue", assignee: "user_john", status: "waiting", waitingReason: "Requested missing workbook from candidate", waitingUntil: "2026-09-13T23:59:00Z", dueAt: "2026-09-13T23:59:00Z", link: "/submissions", sourceRef: "case_c" },
  t4: { id: "t4", title: "Publish Private Markets Portfolio NAV & Valuation Case (FIN-008 v2)", type: "reviewer_queue", assignee: null, queue: "question_review", status: "open", dueAt: "2026-09-12T18:00:00Z", link: "/questions/q_fin008", sourceRef: "q_fin008" },
  t5: { id: "t5", title: "Review Finance Operations plan draft", type: "plan_review", assignee: "user_john", status: "in_progress", dueAt: "2026-09-11T18:00:00Z", link: "/assessments/prj_fin", sourceRef: "prj_fin" },
  t6: { id: "t6", title: "Restore delayed Interview handoff delivery", type: "delivery_recovery", assignee: "user_morgan", status: "completed", dueAt: "2026-09-10T12:00:00Z", link: "/deliveries/del_1", sourceRef: "del_1" },
  t7: { id: "t7", title: "Sofia Bianchi — written test not started", type: "test_pending", assignee: "user_john", status: "open", dueAt: "2026-09-18T23:59:00Z", link: "/cases/case_casey_chan/plan", sourceRef: "case_casey_chan" },
  t8: { id: "t8", title: "Jordan Lee — awaiting written test submission", type: "submission_pending", assignee: "user_john", status: "open", dueAt: "2026-09-18T23:59:00Z", link: "/cases/case_b/plan", sourceRef: "case_b" },
  t9: { id: "t9", title: "Elena Cruz — plan ready, test not yet sent", type: "invite_pending", assignee: "user_john", status: "open", dueAt: "2026-09-20T23:59:00Z", link: "/cases/case_elena/plan", sourceRef: "case_elena" },
};

export interface DeliveryStep { label: string; state: "done" | "pending"; at: string | null }
export interface Delivery { id: string; caseId: string; target: string; status: string; timeline: DeliveryStep[] }
export const DELIVERIES: Record<string, Delivery> = {
  del_1: { id: "del_1", caseId: "case_a", target: "Interview", status: "awaiting_ack", timeline: [
    { label: "Result finalized", state: "done", at: "2026-08-18T11:00:00Z" },
    { label: "Preparing shared artifact", state: "done", at: "2026-08-18T11:02:00Z" },
    { label: "File ready", state: "done", at: "2026-08-18T11:05:00Z" },
    { label: "Event queued", state: "done", at: "2026-08-18T11:05:30Z" },
    { label: "Published", state: "done", at: "2026-08-18T11:06:00Z" },
    { label: "Intake received", state: "pending", at: null },
    { label: "Imported", state: "pending", at: null },
  ] },
};

export const FILES_LIST = ["core_file_001", "core_file_002", "core_file_003", "core_file_004", "core_file_005", "core_file_q001", "core_file_q002"];
export interface FileConnection { id: string; name: string; kind: string; scope: string; status: string; lastSync: string }
export const FILE_CONNECTIONS: FileConnection[] = [
  { id: "conn_mail", name: "hr@sendinglabs.com (inbox)", kind: "Email", scope: "Read-only, assessment mailbox", status: "connected", lastSync: "2026-09-11T07:55:00Z" },
  { id: "conn_drive", name: "Aurora Studio / Hiring / Assessments", kind: "Folder", scope: "Read + write, assessment exports", status: "connected", lastSync: "2026-09-11T07:40:00Z" },
  { id: "conn_ats", name: "External ATS export bucket", kind: "Folder", scope: "Write-only, package exports", status: "auth_required", lastSync: "2026-09-08T12:00:00Z" },
];

export const ACTIVITY: { at: string; text: string }[] = [
  { at: "2026-09-11T07:40:00Z", text: "Daniel Park reviewed Question Bank entry FIN-008 and flagged competency weights for redistribution." },
  { at: "2026-09-11T07:10:00Z", text: "John linked Sofia Bianchi to the Finance Operations Analyst role; written test not yet sent." },
  { at: "2026-09-10T16:20:00Z", text: "Submission Inbox received Casey Chen's reply — missing 1 required deliverable." },
  { at: "2026-09-09T19:05:00Z", text: "Taylor Brooks submitted FIN-001 (round 1)." },
  { at: "2026-09-08T14:02:00Z", text: "Jordan Lee accepted invitation (deadline-only)." },
  { at: "2026-09-04T10:00:00Z", text: "John finalized and published Harper Diaz's evaluation (overall 58) and sent the optional FIN-002 case as a follow-up before the interview decision." },
  { at: "2026-08-18T11:00:00Z", text: "Daniel Park finalized Alex Morgan's evaluation (overall 70)." },
  { at: "2026-08-10T09:00:00Z", text: "Daniel Park finalized and published Devon Ruiz's evaluation (overall 78)." },
];

export interface AiModelTask { task: string; primary: string; fallback: string; budget: string; status: "ok" | "fallback_active"; note?: string }
export const AI_MODEL_TASKS: AiModelTask[] = [
  { task: "question_generate", primary: "Claude Opus 4.6", fallback: "Claude Sonnet 4.5", budget: "$40 / week", status: "ok" },
  { task: "quality_review", primary: "Claude Sonnet 4.5", fallback: "—", budget: "$10 / week", status: "ok" },
  { task: "evidence_map", primary: "Claude Sonnet 4.5", fallback: "Claude Haiku 4.5", budget: "$25 / week", status: "ok" },
  { task: "rubric_evaluate", primary: "Claude Opus 4.6", fallback: "Claude Sonnet 4.5", budget: "$60 / week", status: "fallback_active", note: "Primary model timed out on 2026-09-11 06:10 UTC — approved fallback engaged automatically." },
  { task: "feedback_draft", primary: "Claude Sonnet 4.5", fallback: "—", budget: "$15 / week", status: "ok" },
  { task: "candidate_compare", primary: "Claude Sonnet 4.5", fallback: "—", budget: "$10 / week", status: "ok" },
];

/** Demo clock — resolves to a fixed base instant + an offset the "advance clock" demo tool adds. */
export function nowISO(clockOffsetMin: number): string {
  const base = new Date(DEMO_CLOCK_BASE).getTime() + clockOffsetMin * 60000;
  return new Date(base).toISOString();
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
}
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
}
export function timeAgo(iso: string, clockOffsetMin: number): string {
  if (!iso) return "—";
  const diff = new Date(nowISO(clockOffsetMin)).getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}
