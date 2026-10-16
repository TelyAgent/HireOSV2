/**
 * What a screening requirement may ask for (F05 FR-7 / BR-5, #179). A requirement must be a fact a résumé can
 * show; it can never use a protected attribute or an obvious proxy for one (sex, age, marital or family status,
 * pregnancy, religion, race or ethnicity, nationality or household registration, appearance, health or
 * disability), and it can't be a vague judgement nothing in a résumé could verify. The same rules run in the
 * page (sources must stay in step: hireos-screening-front/src/features/jobs/requirementPolicy.ts).
 */
export type RequirementProblem = { kind: 'protected_attribute' | 'unverifiable'; attribute?: string; suggestion: string };

const PROTECTED: Array<{ attribute: string; pattern: RegExp; suggestion: string }> = [
  // Phrased as a demand on the candidate, so "women's fashion e-commerce" or "女性用户产品" (the market) still pass.
  { attribute: 'sex', pattern: /\b(male|female|men|women|man|woman)\s+(only|candidates?|applicants?|preferred)\b|\b(only|prefer(?:ably)?)\s+(male|female|men|women)\b|\bgender\b|限男|限女|仅限男|仅限女|男性优先|女性优先|男士优先|女士优先|^(男|女)性?$|性别/i, suggestion: 'Describe the work itself, e.g. the physical tasks or shifts the role involves.' },
  { attribute: 'age', pattern: /\b(age|aged|years?\s+old)\b|\b(under|below|over|above)\s+\d{2}\b(?!\s*(%|k|hours?|days?|people|engineers|employees|clients|projects|countries|languages))|\d+\s*岁|岁以[下上内]|年龄/i, suggestion: 'Ask for the experience the role needs, e.g. “3+ years running payment systems”.' },
  { attribute: 'marital or family status', pattern: /\b(married|unmarried|marital|pregnan\w*|maternity)\b|\b(no|without|have)\s+(children|kids)\b|已婚|未婚|婚育|已育|未育|生育|怀孕|单身/i, suggestion: 'State the schedule or travel the role requires instead.' },
  { attribute: 'religion', pattern: /\b(religion|religious|christian|muslim|buddhist|jewish|hindu)\b|宗教|信仰/i, suggestion: 'Leave beliefs out; describe the skills the role needs.' },
  { attribute: 'race, ethnicity or nationality', pattern: /\b(race|racial|ethnic\w*|nationality|native[- ]born|citizen of)\b|民族|种族|国籍|汉族|户籍|户口|本地人/i, suggestion: 'If the role has a legal work requirement, state the work location and let the company verify eligibility separately.' },
  { attribute: 'appearance', pattern: /\b(height|attractive|good[- ]looking|appearance)\b|身高|形象好|颜值|五官|相貌|长相/i, suggestion: 'Describe the client-facing duties, not how a person looks.' },
  { attribute: 'health or disability', pattern: /\b(disabilit\w*|disabled|health status)\b|残疾|健康状况|身体健康|无疾病/i, suggestion: 'Describe the duties of the role; accommodations are handled separately.' },
];

const UNVERIFIABLE = /^(?:(?:a|an|the)\s+)?(?:great|good|nice|excellent|awesome|amazing|strong|positive)\s+(?:person|people|guy|candidate|attitude|personality|fit|vibes?)\.?$|^culture\s+fit\.?$|^team\s+player\.?$|^人品好|^靠谱|^优秀的人|^积极向上|^有激情|^性格好|^好相处/i;

export function requirementProblem(label: string): RequirementProblem | null {
  const text = label.normalize('NFKC').trim();
  if (!text) return null;
  for (const rule of PROTECTED) {
    if (rule.pattern.test(text)) return { kind: 'protected_attribute', attribute: rule.attribute, suggestion: rule.suggestion };
  }
  if (UNVERIFIABLE.test(text)) {
    return { kind: 'unverifiable', suggestion: 'Rewrite it as a fact a résumé can show, e.g. “Led a team of 5+” or “Shipped a mobile app to production”.' };
  }
  return null;
}
