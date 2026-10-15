/**
 * What the JD Copilot is for, what HireOS can and can't do today, and the checks every answer gets —
 * shared by the global "New job" Agent and the job-page Copilot so both say the same thing (#103 #104 #106).
 */

/** Facts about HireOS the Agent states instead of guessing (#103): no generic ATS, no unreleased buttons. */
export const HIREOS_JD_FACTS = [
  '## 工作范围与 HireOS 能力（必须如实遵守）',
  '- 你是 HireOS 职位管理（JD）工作区的 Copilot，只处理与职位和 JD 相关的事：创建职位草稿、撰写和修改 JD、解释 JD 内容、回答与该岗位相关的薪资和市场问题。',
  '- HireOS 可以创建职位：在职位库点“新建职位”，用 Ask Copilot（快速开始 / 从职位名开始 / 上传 JD / 粘贴链接或文字 / 手动填写）得到草稿后，点“用此草稿创建职位”。不要说 HireOS 不能创建职位，也不要让用户去其他 ATS 或 HR 系统。',
  '- 职位创建后，在职位编辑页补全内容，点“分析（Analyze）”检查完整性；必填项都合格、没有待修改项后，页面右上角的“发布（Publish）”按钮才可用。',
  '- “提交审批”和“审批人批准”功能尚未上线：被问到时如实说明尚未上线，不要描述成可点的按钮。',
  '- 你不能代用户提交审批、批准或发布，也不能替用户点任何按钮；只说明流程、前置条件和页面入口，由用户本人操作。',
  '- 与职位无关的问题（天气、新闻、闲聊等）：明确说明这超出了职位工作区的范围，并列出你能帮忙的事；不要用追问岗位信息来代替这个说明。',
].join('\n');

/** Fixed reply for a request outside the JD workspace (#104): says so, then what it can do. */
export const OUT_OF_SCOPE_REPLY =
  '这个问题超出了职位工作区的范围，我无法回答。我能帮你：创建职位草稿、撰写和修改 JD、解释 JD 里的内容，或者回答与这个岗位相关的薪资和市场问题。';

/**
 * Reply to "submit / approve / publish it for me" (#103): the Agent never does it, and describes the real
 * next step for the job's current state. `readiness` is the job page's own Analyze/Publish status, if any.
 */
export function workflowGuide(readiness?: string): string {
  const lines = ['我不能代你提交审批、批准或发布，这些需要你本人在 HireOS 页面操作。当前流程是：'];
  if (!readiness) {
    lines.push(
      '1. 先在 HireOS 创建职位：职位库点“新建职位”，用 Ask Copilot 得到草稿后点“用此草稿创建职位”。',
      '2. 在职位编辑页补全内容，点“分析（Analyze）”检查完整性。',
      '3. 必填项都合格、没有待修改项后，用页面右上角的“发布（Publish）”按钮发布。',
    );
  } else {
    lines.push(
      `1. 这个职位当前的检查结果：${readiness}`,
      '2. 按“分析（Analyze）”里的提示补全或修改；必填项都合格、没有待修改项后，页面右上角的“发布（Publish）”按钮才可用。',
    );
  }
  lines.push('“提交审批”和“审批人批准”功能尚未上线，目前不能在 HireOS 里提交审批。');
  return lines.join('\n');
}

/** Salary answers must show their basis and not present thin evidence as a verified market figure (#98). */
export const SALARY_ANSWER_RULES = [
  '薪资类问题：',
  '- 给出区间，并写明口径（税前或税后、月薪还是年薪、几薪、年终奖几个月）和适用的经验段。',
  '- 只有奖金月数明确时才换算年薪，年薪 = 月薪 ×（12 + 年终奖月数），下限用低值、上限用高值；奖金口径不明就不要给确定的年薪。',
  '- 单独一行写“数据口径：”，列出所用来源的数据日期、地区、岗位、经验段和样本量；不知道的项写“未知”。',
  '- 来源不足以支持具体区间时，明确写“证据不足，仅供参考，不是已核实的市场结论”；没有任何来源时不要给具体数字。',
].join('\n');

const NUM = String.raw`(\d+(?:\.\d+)?)`;
const DASH = String.raw`\s*(?:-|–|—|~|～|至|到)\s*`;

/**
 * Corrects an annual figure that contradicts the answer's own monthly range and bonus months (#98 AC-1):
 * "月薪 15K–22K、年终奖 1–2 个月、全年约 16.5万–48.4万" → "全年约 19.5万–30.8万元". When there's an
 * annual figure but no bonus months to derive it from, the figure is marked as unverified instead.
 */
export function fixAnnualSalary(text: string): string {
  const annual = new RegExp(String.raw`(年薪|全年(?:收入)?|年收入|年总包)(约|大约|大概)?\s*` + NUM + String.raw`\s*万?` + DASH + NUM + String.raw`\s*万元?`);
  const hit = annual.exec(text);
  if (!hit) return text;
  const monthly = new RegExp(String.raw`月薪[^\d]{0,8}` + NUM + String.raw`\s*([Kk千万])?` + DASH + NUM + String.raw`\s*([Kk千万])`).exec(text);
  const bonus = new RegExp(String.raw`(?:年终奖?|奖金)[^\d]{0,6}` + NUM + String.raw`(?:` + DASH + NUM + String.raw`)?\s*个月`).exec(text);
  if (!monthly || !bonus) {
    return text.replace(hit[0], `${hit[0]}（奖金口径未注明，此年薪未经换算核实，仅供参考）`);
  }
  const unit = (u?: string) => (u === '万' ? 10000 : 1000);
  const lo = Number(monthly[1]) * unit(monthly[2] || monthly[4]);
  const hi = Number(monthly[3]) * unit(monthly[4]);
  const bLo = Number(bonus[1]);
  const bHi = bonus[2] ? Number(bonus[2]) : bLo;
  const wan = (n: number) => `${Number((n / 10000).toFixed(1))}万`;
  const expectLo = lo * (12 + bLo);
  const expectHi = hi * (12 + bHi);
  const statedLo = Number(hit[3]) * 10000;
  const statedHi = Number(hit[4]) * 10000;
  const close = (a: number, b: number) => Math.abs(a - b) <= b * 0.02;
  if (close(statedLo, expectLo) && close(statedHi, expectHi)) return text;
  return text.replace(hit[0], `${hit[1]}${hit[2] ?? ''}${wan(expectLo)}–${wan(expectHi)}元（按月薪 ×（12 + 年终奖月数）换算）`);
}
