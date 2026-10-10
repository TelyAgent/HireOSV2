/**
 * Rule-based JD completeness check (JD Completeness Standard v0.1 — CMD-JD-CHK-001).
 *
 * Deterministic and instant, so it can gate publishing: the 10 required items (§2, "Required"),
 * the "Weak" defects that are reliably detectable with rules, and the visibility / compliance rules
 * from §4 that are blocking and keyword-detectable. The deeper, judgement-based checks (verifiability,
 * requirement ↔ responsibility coverage, …) belong to the LLM analysis.
 *
 * Headings and defects are matched in both English and Chinese, since JDs here are written in either.
 */
import { blockLevel, blockPlainText, groupSections, type DocSection } from "./docHelpers";
import type { BlockLevel, DocBlock, DocumentDraft, Job } from "../../data/types";

export type ReqGroup = "fields" | "content" | "publish";

export interface ReqItem {
  id: string;
  group: ReqGroup;
  label: string;
  hint: string;
  /** Job field checked (fields group). */
  field?: "title" | "level" | "location" | "headcount";
  /** Content items: the section that holds them. */
  heading?: { en: string; zh: string };
  match?: RegExp;
  /** The role summary lives in the lead (title) section rather than under its own heading. */
  lead?: boolean;
  list?: boolean;
  level?: BlockLevel;
  /** Only Public blocks count (F1: the internal ceiling under the same heading doesn't). */
  publicOnly?: boolean;
  /** No AI draft / fix: the content is a business fact the AI must not invent (salary numbers). */
  noAi?: boolean;
}

export const REQ_GROUP_LABELS: Record<ReqGroup, string> = {
  fields: "Job fields",
  content: "Document content",
  publish: "Publishing",
};

export const REQ_ITEMS: ReqItem[] = [
  { id: "A1", group: "fields", label: "Job title", hint: "Name the role: function + seniority.", field: "title" },
  { id: "A4", group: "fields", label: "Level", hint: "e.g. Junior, Senior, Lead, Manager.", field: "level" },
  { id: "A7", group: "fields", label: "Location", hint: "City + country; for Remote, name the accepted regions.", field: "location" },
  { id: "A8", group: "fields", label: "Headcount", hint: "Number of openings (1 or more).", field: "headcount" },
  {
    id: "B1",
    group: "content",
    label: "Role summary",
    hint: "2–4 sentences: what the role does, for whom, and why it matters.",
    heading: { en: "About the role", zh: "职位概述" },
    match: /summary|overview|about the role|职位概述|岗位概述|职位简介|岗位简介|关于(这个)?(职位|岗位)/i,
    lead: true,
    level: "public",
  },
  {
    id: "C1",
    group: "content",
    label: "Core responsibilities",
    hint: "3–8 bullets, each starting with a verb.",
    heading: { en: "Responsibilities", zh: "岗位职责" },
    match: /responsib|what you.?ll do|职责|工作内容/i,
    list: true,
    level: "public",
  },
  {
    id: "D1",
    group: "content",
    label: "Requirements",
    hint: "3–8 verifiable requirements, including at least 2 specific skills or tools.",
    heading: { en: "Requirements", zh: "任职要求" },
    match: /requirement|qualification|must|任职要求|岗位要求|任职资格|任职条件/i,
    list: true,
    level: "public",
  },
  {
    id: "F1",
    group: "content",
    label: "Public salary range",
    hint: "Min + max + currency + period (month / year), gross or net.",
    heading: { en: "Compensation", zh: "薪资福利" },
    match: /compensation|salary|pay\b|薪资|薪酬|待遇/i,
    level: "public",
    publicOnly: true,
    noAi: true,
  },
  { id: "I1", group: "publish", label: "Every block has a visibility level", hint: "Public / Internal / Confidential." },
  { id: "I2", group: "publish", label: "Unique JD ID", hint: "Assigned by the system." },
  { id: "I7", group: "publish", label: "Language version", hint: "The language the JD is written in." },
];

/** Optional sections suggested once the user has run Analyze (§2 B2, D7, C2, C3). */
export const REQ_SUGGEST: ReqItem[] = [
  {
    id: "B2",
    group: "content",
    label: "Business problem",
    hint: "Explain why this role is needed now.",
    heading: { en: "Business problem", zh: "业务背景" },
    match: /business|problem|context|why (we|this)|业务背景|招聘背景/i,
    level: "internal",
  },
  {
    id: "D7",
    group: "content",
    label: "Preferred",
    hint: "Nice-to-have skills (up to 5), kept apart from the requirements.",
    heading: { en: "Preferred", zh: "加分项" },
    match: /preferred|nice.?to.?have|加分|优先/i,
    list: true,
    level: "public",
  },
  {
    id: "C2",
    group: "content",
    label: "Expected outcomes",
    hint: "What the person should achieve — measurable if possible.",
    heading: { en: "Expected outcomes", zh: "预期成果" },
    match: /outcome|deliverable|expected results?|预期成果|关键交付/i,
    list: true,
    level: "internal",
  },
  {
    id: "C3",
    group: "content",
    label: "Success criteria",
    hint: "What success looks like at 30 / 90 days.",
    heading: { en: "Success in the first 90 days", zh: "入职成功标准" },
    match: /success|first (30|90)|成功标准|入职.*(30|90|三个月)/i,
    list: true,
    level: "internal",
  },
];

/** Default section order: title & summary → Responsibilities → Requirements → Preferred → Compensation → Success. */
export function sectionRank(text: string): number {
  if (/business|problem|about the role|summary|overview|业务背景|职位概述|岗位概述/i.test(text)) return 0.5;
  if (/responsib|what you.?ll do|职责|工作内容/i.test(text)) return 1;
  if (/requirement|qualification|must|任职要求|岗位要求|任职资格/i.test(text)) return 2;
  if (/preferred|nice.?to.?have|加分|优先/i.test(text)) return 3;
  if (/compensation|salary|benefit|pay\b|薪资|薪酬|福利/i.test(text)) return 4;
  if (/success|outcome|deliverable|first (30|90)|成功标准|预期成果/i.test(text)) return 5;
  return 99;
}

/* ---------------- helpers ---------------- */

const CJK = /[㐀-鿿]/;
const PLACEHOLDER =
  /^(new paragraph|new item|add content here\.?|no role summary on file\.?|this job has no confirmed requirements yet.*|not specified|未指定|待定)$/i;
/** Internal context lines that sit under the title but aren't the summary. */
const META_LINE = /^(team|hiring manager|reports? to|recruiter|团队|用人经理|汇报对象)\s*[:：·]/i;

function plain(b: DocBlock) {
  return blockPlainText(b).replace(/\u00a0/g, " ").trim();
}
/** Counts CJK characters double so length thresholds work for Chinese and English alike. */
function textWeight(t: string) {
  let n = 0;
  for (const ch of t) n += CJK.test(ch) ? 2 : 1;
  return n;
}
export function isFilled(t: string) {
  return textWeight(t) >= 3 && !PLACEHOLDER.test(t);
}
function isBlank(v: unknown) {
  return v == null || String(v).trim() === "" || String(v).trim() === "—";
}
function maxYears(text: string) {
  const ys = [...text.matchAll(/(\d+)\s*\+?\s*(?:years?|yrs|年)/gi)].map((m) => Number(m[1]));
  return ys.length ? Math.max(...ys) : 0;
}
function sentenceCount(t: string) {
  return t.split(/[.!?。！？]+/).filter((x) => textWeight(x.trim()) > 4).length;
}

export function findSection(secs: DocSection[], item: ReqItem, blocks: DocBlock[]): { sec: DocSection | null; byHead: boolean } {
  // The first section is the title section (its heading is the job title), never a named section.
  const cand = secs.filter((s, i) => !(i === 0 && s.head && s.head === blocks[0]));
  const byHead = cand.find((s) => s.head && item.match?.test(plain(s.head)));
  if (byHead) return { sec: byHead, byHead: true };
  return { sec: item.lead ? (secs[0] ?? null) : null, byHead: false };
}

/** Body blocks of a section that count as content for `item`. */
export function filledBlocks(sec: DocSection | null, item: ReqItem) {
  if (!sec) return [];
  return sec.blocks.filter((b) => {
    const t = plain(b);
    return isFilled(t) && !(item.lead && META_LINE.test(t)) && !(item.publicOnly && blockLevel(b) !== "public");
  });
}

/** The document's language, from its text (completeness standard I7). */
export function detectLanguage(blocks: DocBlock[]): "zh" | "en" | null {
  const text = blocks.map(plain).join(" ");
  if (!text.trim()) return null;
  const cjk = [...text].filter((ch) => CJK.test(ch)).length;
  return cjk > 0 && cjk * 2 >= text.replace(/\s/g, "").length * 0.3 ? "zh" : "en";
}

/* ---------------- "Needs revision" (Weak) rules ---------------- */

const VAGUE =
  /(strong|good|excellent|great)\s+(communication|interpersonal|leadership)|team player|fast learner|quick learner|hard.?working|self.?motivated|passionate|detail.?oriented|go.?getter|沟通能力强|良好的沟通|学习能力强|抗压能力|团队合作精神|责任心强|吃苦耐劳|积极主动|执行力强/i;
const GENERIC_SKILL = /microsoft office|ms office|computer skills|office software|熟悉办公软件|熟练使用\s*office|办公软件/i;

export type Lang = "en" | "zh";
/** Picks the message in the UI language (messages with values in them can't go through the i18n table). */
type Say = (en: string, zh: string) => string;
const sayIn = (lang: Lang): Say => (en, zh) => (lang === "zh" ? zh : en);

interface WeakCtx {
  job: Job;
  items: Record<string, string[]>;
  requirementText: string;
  L: Say;
}
const WEAK_RULES: Record<string, (c: WeakCtx) => string> = {
  A1: ({ job, L }) => {
    const t = String(job.title || "").trim();
    if (/\b(rockstar|ninja|guru|wizard)\b|大牛|大神|牛人/i.test(t)) return L("Avoid marketing words such as “Rockstar” or “Ninja” in the job title.", "职位名称中不要使用“大牛”“Ninja”这类营销词。");
    if (/[A-Z]{2,}-?\d{2,}|#\d+/.test(t)) return L("Remove internal codes from the job title.", "去掉职位名称中的内部编号或代号。");
    if (/^(senior|junior|lead|staff|principal|head|chief|高级|资深|初级|中级)$/i.test(t)) return L("Add the function to the title, e.g. “Senior Backend Engineer”.", "职位名称要包含职能，如“高级后端工程师”，不能只写资历。");
    if (t.length > 60) return L("Keep the job title under 60 characters.", "职位名称不要超过 60 个字。");
    return "";
  },
  A4: ({ job, requirementText, L }) => {
    const lvl = String(job.level || "");
    const y = maxYears(requirementText);
    if (/junior|intern|entry|初级|实习|应届/i.test(lvl) && y >= 5) return L(`Level “${lvl}” conflicts with the ${y}+ years of experience required.`, `级别“${lvl}”与要求的 ${y} 年以上经验矛盾。`);
    if (/director|head|vp|principal|总监|负责人/i.test(lvl) && y && y <= 2) return L(`Level “${lvl}” looks high for only ${y} years of experience required.`, `只要求 ${y} 年经验，级别“${lvl}”偏高。`);
    return "";
  },
  A7: ({ job, L }) =>
    /^(remote|远程)$/i.test(String(job.location || "").trim())
      ? L("Remote roles should name the accepted regions or time zones.", "远程岗位需要写明可接受的地区或时区。")
      : "",
  B1: ({ items, L }) => {
    const n = sentenceCount((items.B1 ?? []).join(" "));
    if (n < 2) return L("Use 2–4 sentences: what the role does, for whom, and why it matters.", "用 2–4 句话说明：这个职位做什么、为谁做、价值是什么。");
    if (n > 5) return L("Shorten to 2–4 sentences.", "精简到 2–4 句话。");
    return "";
  },
  C1: ({ items, L }) => {
    const b = items.C1 ?? [];
    if (b.length < 3) return L("Add at least 3 responsibilities.", "至少写 3 条职责。");
    if (b.some((x) => /^(responsible for|in charge of)\b|^负责(相关|其他|.{0,2}工作$)/i.test(x))) return L("Start each responsibility with an action verb and a concrete object, not “Responsible for…”.", "每条职责用动词开头并写明对象，不要写“负责相关工作”。");
    if (b.length > 8) return L("Keep to 8 responsibilities or fewer.", "职责不要超过 8 条。");
    return "";
  },
  F1: ({ items, L }) => salaryWeak((items.F1 ?? []).join(" "), L),
  D1: ({ items, L }) => {
    const b = items.D1 ?? [];
    if (b.length < 3) return L("Add at least 3 requirements.", "至少写 3 条任职要求。");
    const vague = b.map((x) => x.match(VAGUE)).find(Boolean);
    if (vague) return L(`“${vague[0]}” can’t be verified — describe the observable behavior instead.`, `“${vague[0]}”无法验证，请写成可观察的具体表现。`);
    if (b.some((x) => GENERIC_SKILL.test(x))) return L("Name specific skills or tools instead of generic ones.", "写明具体的技能或工具，不要写“熟悉办公软件”这类通用技能。");
    if (b.length > 8) return L("Keep to 8 requirements or fewer.", "任职要求不要超过 8 条。");
    return "";
  },
};

/* F1 — public salary range: min + max + currency + period (+ gross / net). */
const SALARY_RANGE = /\d[\d,.]*\s*[kKwW万千]?\s*(?:-|–|—|~|～|至|到|to)\s*\d/;
const SALARY_CURRENCY = /\b(USD|CNY|RMB|SGD|HKD|EUR|GBP|JPY|VND|AUD|CAD|MYR|THB|IDR|PHP|INR)\b|[$¥￥€£]|元|人民币|美元|港币|新币|欧元/i;
const SALARY_PERIOD = /month|monthly|\/\s*mo\b|year|yearly|annual|annum|\/\s*yr\b|hour|hourly|月|年|时薪|小时|日薪|天/i;
export const SALARY_TAX = /gross|net\b|pre-?tax|after-?tax|before tax|税前|税后/i;
const SALARY_NEGOTIABLE = /negotiable|competitive|\bDOE\b|depending on experience|面议|薪资面谈|待遇优厚/i;

function salaryWeak(text: string, L: Say): string {
  if (SALARY_NEGOTIABLE.test(text) && !SALARY_RANGE.test(text)) {
    return L("“Negotiable” isn’t a range — give min and max with currency and pay period.", "只写“面议”不算薪资范围，请写明最低值、最高值、币种和周期。");
  }
  const lacks: [boolean, string, string][] = [
    [!SALARY_RANGE.test(text), "min–max range", "最低–最高范围"],
    [!SALARY_CURRENCY.test(text), "currency", "币种"],
    [!SALARY_PERIOD.test(text), "pay period (month / year)", "周期（月 / 年）"],
    [!SALARY_TAX.test(text), "gross or net", "税前 / 税后"],
  ];
  const missing = lacks.filter(([m]) => m);
  if (!missing.length) return "";
  return L(`Salary range is missing: ${missing.map((x) => x[1]).join(", ")}.`, `薪资范围缺少：${missing.map((x) => x[2]).join("、")}。`);
}

/* ---------------- X5: internal ceiling vs public range ---------------- */
/*
 * Runs locally — the ceiling lives in a Confidential block, which is never sent to the AI (V5).
 * Deliberately conservative: it only reports when both amounts parse cleanly and are comparable
 * (same currency, convertible period); anything ambiguous is skipped rather than guessed.
 */

export type Period = "month" | "year" | null;
interface Money {
  amounts: number[];
  currency: string | null;
  period: Period;
}

const AMOUNT = /(\d+(?:[.,]\d+)*)\s*([kK千wW万])?/g;
const CEILING_HINT = /ceiling|budget|上限|预算/i;

export function currencyOf(text: string): string | null {
  if (/\b(CNY|RMB)\b|人民币|元|¥|￥/i.test(text)) return "CNY";
  if (/\bUSD\b|美元|US\$/i.test(text)) return "USD";
  const code = text.match(/\b(SGD|HKD|EUR|GBP|JPY|VND|AUD|CAD|MYR|THB|IDR|PHP|INR)\b/i);
  if (code) return code[1].toUpperCase();
  if (/€/.test(text)) return "EUR";
  if (/£/.test(text)) return "GBP";
  if (/\$/.test(text)) return "USD";
  return null;
}
export function periodOf(text: string): Period {
  const month = /month|monthly|\/\s*mo\b|月/i.test(text);
  const year = /year|yearly|annual|annum|\/\s*yr\b|年薪|每年|\/年/i.test(text);
  return month === year ? null : month ? "month" : "year";
}
export function parseMoney(text: string): Money | null {
  const raw = [...text.matchAll(AMOUNT)]
    // Skip years of experience and other small counts ("3 年以上"), keep salary-sized numbers.
    .map((m) => ({ n: Number(m[1].replace(/,/g, "")), unit: m[2]?.toLowerCase() ?? "" }))
    .filter((x) => Number.isFinite(x.n));
  if (!raw.length) return null;
  // "25-35k": a unit written once applies to the whole range.
  const shared = raw.find((x) => x.unit)?.unit ?? "";
  const scale = (u: string) => (u === "k" || u === "千" ? 1e3 : u === "w" || u === "万" ? 1e4 : 1);
  const amounts = raw.map((x) => x.n * scale(x.unit || shared)).filter((n) => n >= 100);
  return amounts.length ? { amounts, currency: currencyOf(text), period: periodOf(text) } : null;
}
function monthly(amount: number, period: Period) {
  return period === "year" ? amount / 12 : amount;
}

function checkCeiling(sections: DocSection[], blocks: DocBlock[], L: Say): ComplianceFlag[] {
  const f1 = REQ_ITEMS.find((i) => i.id === "F1")!;
  const publicBlock = filledBlocks(findSection(sections, f1, blocks).sec, f1).find((b) => SALARY_RANGE.test(plain(b)));
  const ceilingBlock = blocks.find((b) => blockLevel(b) === "confidential" && CEILING_HINT.test(plain(b)) && parseMoney(plain(b)));
  if (!publicBlock || !ceilingBlock) return [];
  const pub = parseMoney(plain(publicBlock));
  const cap = parseMoney(plain(ceilingBlock));
  if (!pub || !cap || pub.amounts.length < 2) return [];
  if (pub.currency && cap.currency && pub.currency !== cap.currency) return [];
  // Different stated periods convert. When only one side states it, assume the same period only if the
  // amounts are of the same magnitude (a month/year mix-up is a ×12 gap); otherwise don't guess.
  let pubPeriod = pub.period;
  let capPeriod = cap.period;
  if ((pubPeriod === null) !== (capPeriod === null)) {
    const ratio = Math.max(...cap.amounts) / Math.max(...pub.amounts);
    if (ratio < 0.2 || ratio > 5) return [];
    pubPeriod = capPeriod = pubPeriod ?? capPeriod;
  }
  const publicMax = monthly(Math.max(...pub.amounts), pubPeriod);
  const publicMin = monthly(Math.min(...pub.amounts), pubPeriod);
  const ceiling = monthly(Math.max(...cap.amounts), capPeriod);
  if (ceiling >= publicMax) return [];
  return [
    {
      rule: "X5",
      severity: "warning",
      blockId: publicBlock.id,
      evidence: plain(publicBlock),
      message:
        ceiling < publicMin
          ? L("The internal budget ceiling is below the bottom of the public salary range.", "内部预算上限低于对外薪资范围的下限。")
          : L("The public salary range goes above the internal budget ceiling.", "对外薪资范围的上限高于内部预算上限。"),
    },
  ];
}

/* ---------------- visibility & compliance (§4) ---------------- */

export interface ComplianceFlag {
  rule: string;
  severity: "blocker" | "warning";
  blockId: string;
  message: string;
  evidence: string;
  /** Visibility the block should have (V1/V2). */
  shouldBe?: BlockLevel;
}

const CONFIDENTIAL_CONTENT = /internal (ceiling|budget)|budget ceiling|backfill|replacing .{1,40} because|内部预算|预算上限|薪资上限|内部薪资|替换.{0,10}原因|顶替/i;
const DISCRIMINATION =
  /\b(male|female|men|women) only\b|\bunder \d{2}( years old)?\b|\baged? (under|below) \d{2}\b|\b(married|unmarried|single) (only|preferred)\b|限男|限女|仅限男|仅限女|男性优先|女性优先|\d{2}\s*(周)?岁以下|年龄.{0,4}(以下|以内|不超过)|已婚|未婚|已育|未育|无不良嗜好.{0,4}民族|汉族|宗教信仰/i;
const NATIONALITY = /\b(citizens?|nationals?) only\b|仅限.{1,6}(国籍|籍)|只招.{1,6}(国籍|籍)|限.{1,6}国籍/i;
const BIASED_WORDING = /young and energetic|digital native|salesman|\bhe will\b|年轻有活力|年轻化团队/i;

function checkCompliance(blocks: DocBlock[], L: Say): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  for (const b of blocks) {
    const t = plain(b);
    if (!t) continue;
    const level = blockLevel(b);
    const conf = level !== "confidential" && t.match(CONFIDENTIAL_CONTENT);
    if (conf) {
      flags.push({
        rule: level === "public" ? "V2" : "V1",
        severity: "blocker",
        blockId: b.id,
        evidence: conf[0],
        shouldBe: "confidential",
        message: L(
          `Looks like confidential content (“${conf[0]}”) in a ${level === "public" ? "Public" : "Internal"} block — mark it Confidential.`,
          `“${conf[0]}”看起来是保密内容，却放在了${level === "public" ? "对外公开" : "内部可见"}块里，请标为保密。`,
        ),
      });
    }
    const disc = t.match(DISCRIMINATION);
    if (disc) flags.push({ rule: "R1", severity: "blocker", blockId: b.id, evidence: disc[0], message: L(`“${disc[0]}” uses age, gender, marital status, ethnicity or religion as a condition.`, `“${disc[0]}”把年龄、性别、婚育、民族或宗教作为条件，不合规。`) });
    const nat = t.match(NATIONALITY);
    if (nat) flags.push({ rule: "R2", severity: "blocker", blockId: b.id, evidence: nat[0], message: L(`“${nat[0]}” — state the required work authorization instead of a nationality.`, `“${nat[0]}”属于国籍限制，请改为“需在某地合法工作”。`) });
    const bias = t.match(BIASED_WORDING);
    if (bias) flags.push({ rule: "R3", severity: "warning", blockId: b.id, evidence: bias[0], message: L(`“${bias[0]}” implies an age or gender — use neutral wording.`, `“${bias[0]}”带有年龄或性别暗示，请使用中性措辞。`) });
  }
  return flags;
}

/* ---------------- evaluation ---------------- */

export interface ReqRow {
  item: ReqItem;
  ok: boolean;
  /** Why it's missing (when !ok). */
  note: string;
  /** "Needs revision" message (when ok but weak). */
  weak: string;
  /** Content items: the section holding it (null = the section doesn't exist yet). */
  section?: DocSection | null;
}

export interface Evaluation {
  rows: ReqRow[];
  flags: ComplianceFlag[];
  sections: DocSection[];
  missing: number;
  weakCount: number;
  blockers: number;
  total: number;
  /** Required items that pass with nothing to revise. */
  passed: number;
  language: "zh" | "en" | null;
  /** Optional sections still empty (shown as suggestions). */
  suggestions: ReqItem[];
}

/** `jdCode`: undefined while the job's versions are still loading (not reported as missing then). */
export function evaluateJob(job: Job, draft: DocumentDraft, lang: Lang = "en", jdCode?: string | null): Evaluation {
  const L = sayIn(lang);
  const blocks = draft.blocks;
  const sections = groupSections(blocks);
  const language = detectLanguage(blocks);
  const reqSec = REQ_ITEMS.find((i) => i.id === "D1")!;
  const requirementText = filledBlocks(findSection(sections, reqSec, blocks).sec, reqSec).map(plain).join(" ");
  const ctx: WeakCtx = { job, items: {}, requirementText, L };

  const rows: ReqRow[] = REQ_ITEMS.map((item) => {
    let ok = false;
    let note = "";
    let section: DocSection | null | undefined;
    if (item.field) {
      const v = job[item.field];
      ok = item.field === "headcount" ? Number(v) >= 1 : !isBlank(v);
      note = "Required — not filled in.";
    } else if (item.heading) {
      const found = findSection(sections, item, blocks);
      section = found.sec;
      const has = filledBlocks(found.sec, item);
      // Present-but-short content is a "Needs revision" (Weak) case, not a missing one.
      ok = has.length > 0;
      ctx.items[item.id] = has.map(plain);
      note = !found.sec
        ? "Section missing."
        : item.publicOnly && found.sec.blocks.some((b) => isFilled(plain(b)))
          ? "No Public content here — the salary range must be visible externally."
          : "This section is empty.";
    } else if (item.id === "I1") {
      ok = blocks.every((b) => !!b.level);
      note = "Some blocks have no visibility level.";
    } else if (item.id === "I2") {
      ok = jdCode !== null;
      note = "Not assigned yet.";
    } else if (item.id === "I7") {
      ok = !!language;
      note = "The document has no text yet.";
    }
    const weak = ok && WEAK_RULES[item.id] ? WEAK_RULES[item.id](ctx) : "";
    return { item, ok, note, weak, section };
  });

  const flags = [...checkCompliance(blocks, L), ...checkCeiling(sections, blocks, L)];
  const suggestions = REQ_SUGGEST.filter((item) => filledBlocks(findSection(sections, item, blocks).sec, item).length === 0);
  const missing = rows.filter((r) => !r.ok).length;
  const weakCount = rows.filter((r) => r.ok && r.weak).length + flags.filter((f) => f.severity === "warning").length;
  const blockers = flags.filter((f) => f.severity === "blocker").length;
  return {
    rows,
    flags,
    sections,
    missing,
    weakCount,
    blockers,
    total: REQ_ITEMS.length,
    passed: rows.filter((r) => r.ok && !r.weak).length,
    language,
    suggestions,
  };
}

/** Completeness standard §1.4: Ready / Needs work / Blocked. */
export function verdictOf(ev: Evaluation): "ready" | "needs_work" | "blocked" {
  if (ev.missing || ev.blockers) return "blocked";
  if (ev.weakCount) return "needs_work";
  return "ready";
}

/** Issues that must be fixed before publishing. */
export function issueCount(ev: Evaluation) {
  return ev.missing + ev.weakCount + ev.blockers;
}
