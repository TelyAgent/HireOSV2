const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inspectIssue, validateIssue } = require('../../.github/scripts/issue-contract.cjs');

const changes = {
  93: { estimate: '5', ready: 'No', decision: '以最新 PRD 为准：10 项必填，Level 选填。保留 Keep、已保存同 revision、分析有效、Weak/阻断规则。Ready 只允许提交审批，发布仍需有效批准。', dependencies: 'Blocked by: #91（真实审批提交接口/冻结版本与批准记录；本 Issue 不重建角色或整套邮件审批）。Refs #54、#55、#56、#87。', analysis: '跨分析、保存、前后端门禁和 X/V/R 分级矩阵；复用已有 publishGate 和发布测试。5 点不含 #91 审批系统的建设；该依赖未解除，保持 AI Ready No。' },
  87: { estimate: '2', ready: 'Yes', decision: '10 项必填、Level 选填；Suggestions 不阻断，真正 Weak/阻断仍阻断。旧 AC 中 To revise 不能泛指建议。Ready 后提交审批，Publish 仍需有效批准。', dependencies: 'Refs #93（共用 M6 门禁）、#53、#56。只验证建议分级不额外阻断；真实审批链路由 #91/#93 跟踪，不把 mock 作为完整审批验收。', analysis: '局部计数、分析分组和提示，加建议/缺项/真正阻断三组前后端回归；共用门禁基础不重复计点。', ac: '- AC-1: 当前 10 项必填已通过、Level 可未设置、仅剩 Suggestions 时，Analyze 保留建议，前置门禁不因建议被拒绝；Publish 是否可用仍服从有效审批等既有门槛。UI/API 自动测试验证建议分级。\n- AC-2: 缺一个必填项且另有建议时，阻断原因和数量仅列阻断项，建议单独展示；UI 测试验证。\n- AC-3: 真正 Weak 或阻断性错误仍禁止推进并指出原因；回归测试区分 Suggestions、Weak 和 blocker。' },
  397: { estimate: '5', ready: 'Yes', decision: '允许测评未达标时人工选择 Passed，但必须记录覆盖理由、决定人和时间；历史决定和已发布测评不自动改写。', dependencies: '与 #399 共用同一修复和证据，主实现由本 Issue 承接；产品覆盖政策已确认。', analysis: '增量审计字段与历史兼容、DTO/API 校验、事务保存、内部回看及 UI/API/并发测试；不重建评分/通知系统。#399 重叠范围不重复累计交付量。', ac: '- AC-1: 已发布测评未达标而人工选择 Passed 时，提交前提示覆盖并收集非空理由；服务端校验并保存理由、可信决定人和时间，直接 API 请求不能绕过。\n- AC-2: 回看页区分已发布测评结果与人工关闭决定；显示可核查的覆盖说明，对历史缺失字段如实显示未记录，不改写原结果或历史决定。\n- AC-3: 自动测试覆盖正常通过、未达标拒绝、未达标人工通过、缺理由及异常/并发路径，核对 UI/API/持久化一致性及失败无部分写入。' },
  399: { estimate: '5', ready: 'Yes', decision: '允许人工 Passed 覆盖未达标测评，必须记录并显示理由、决定人和时间；测评结果和关闭决定分别展示。', dependencies: '与 #397 共用修复、迁移和证据；由 #397 主实现，两项分别核对 AC，重复范围仅计一次交付量。', analysis: '按独立完整范围同样涉及审计迁移、服务端校验和 API/UI 回看，评为 5；实际与 #397 合并实施，不额外累计 5 点。' },
  325: { estimate: '8', ready: 'Yes', decision: 'Required L 由 JD 结构化字段传入，不由 HR 在 Rubric 单独填写，不以统一 L3 冒充逐项要求。原建议 5 点经本轮跨系统链路核查调整为 8，用户已确认。', dependencies: 'JD 结构化等级来源已确认。本 Issue 承接 JD 契约、能力映射/版本存储和逐项判断；不改变已确认的历史 Rubric 内容。Refs #250（复用本项等级链路）。', analysis: '当前 JD facade 将 requirements 压平成 label，CapabilityCard 无逐项等级，Debrief 使用统一阈值；需跨 JD/Interview 契约、增量迁移、版本兼容及 L3/L4 回归，故由建议 5 调整至 8。不是依据实际耗时改分。' },
  250: { estimate: '5', ready: 'No', decision: '能力验证卡作为现有 Rubric 页的候选人视图，复用同一能力 ID 和 JD 等级；Claim 按候选人隔离，STAR 复用现有生成能力，不新建独立卡片审批流程。Required L 来自 JD 结构化字段。', dependencies: 'Blocked by: #325（JD 逐项等级传入与版本链路）。对象关系已确认：Rubric 页候选人视图，不是新独立审批对象。', analysis: '复用 #325 等级基础和现有 Brief STAR；新增候选人 Claim、引用校验、空/错误/版本状态及 UI/API 回归。跨模块为 5，等级基础不重复计点。#325 完成并验证后解除依赖。' },
};
for (const [number, update] of Object.entries(changes)) {
  const current = JSON.parse(execFileSync('gh', ['issue', 'view', number, '--repo', 'TelyAgent/HireOSV2', '--json', 'number,title,body,comments'], { encoding: 'utf8' }));
  const { sections, errors } = inspectIssue(current.body);
  if (errors.length) throw new Error(errors.join('; '));
  fs.writeFileSync(path.join(__dirname, `issue-${number}-before.json`), JSON.stringify(current, null, 2) + '\n');
  sections.Scope = sections.Scope.split('#### Estimate analysis')[0].trim();
  sections.Scope += `\n\n#### Confirmed decision\n\n[HUMAN-DECISION] 2026-10-17：用户在本任务确认 Estimate=${update.estimate}（回复“确认以上点数”）。${update.decision}\n\n#### Estimate analysis\n\n${update.analysis}`;
  sections.Estimate = update.estimate;
  sections['AI Ready'] = update.ready;
  sections.Dependencies = update.dependencies;
  if (update.ac) sections['Acceptance Criteria'] = update.ac;
  sections['Acceptance Criteria'] = sections['Acceptance Criteria'].replace(/(AC-\d+)：/g, '$1:');
  if (number === '93') {
    sections.Scope = sections.Scope.replaceAll('11 项必填', '10 项必填');
    sections['Acceptance Criteria'] = sections['Acceptance Criteria'].replaceAll('11 项', '10 项');
  }
  const body = Object.entries(sections).map(([name, value]) => `### ${name}\n\n${value}\n`).join('\n');
  validateIssue(body, { mode: 'submission' });
  if (update.ready === 'Yes') validateIssue(body, { mode: 'execution' });
  fs.writeFileSync(path.join(__dirname, `issue-${number}.md`), body);
  console.log(`#${number}: Estimate ${update.estimate}, AI Ready ${update.ready}, submission valid`);
}
