const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inspectIssue } = require('../../.github/scripts/issue-contract.cjs');
const updates = {
  335: { decision: '按轮次和题目持久化未问状态，保留首次操作人和时间；重复 Skip 幂等，不自动改评分，Live 刷新和 Review 均显示。', analysis: '复用现有轮次、题目和 Review API，增加增量持久化、幂等写入、跨页面读取和数据库/浏览器回归。跨前后端与两页面，5 点；无新评分或独立流程，不扩为 8 点。', dependency: '持久化和显示契约已由 Owner 确认；复用现有轮次/题目身份，不新增自动评分规则。' },
  296: { decision: '人工理由可填写并随决定保存，显示记录人、时间和独立决定版本；历史缺失字段显示未记录；AI 引用打开生成时的评分快照，不冒充最新评分。', analysis: '复用现有决定 API 和 ParseJob 引用快照，增加理由/身份/独立版本持久化和页面引用入口，覆盖保存、版本和跨任务隔离。跨 API/数据/UI 为 5 点；不实现新评分算法、Offer 或身份角色系统。原 TBD 范围已通过本轮代码核查和 Owner 决定收敛。', dependency: '现有决定和 ParseJob 结构已核对，历史未知显示与快照引用策略已由 Owner 确认。' },
};
for (const [id, change] of Object.entries(updates)) {
  const issue = JSON.parse(execFileSync('gh', ['api', `repos/TelyAgent/HireOSV2/issues/${id}`], { encoding: 'utf8', timeout: 30000 }));
  const comments = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', `repos/TelyAgent/HireOSV2/issues/${id}/comments?per_page=100`], { encoding: 'utf8', timeout: 30000 })).flat();
  fs.writeFileSync(path.join(__dirname, `issue-${id}-before.json`), JSON.stringify({ issue, comments }, null, 2));
  const { sections, errors } = inspectIssue(issue.body);
  if (errors.length) throw Error(errors.join('; '));
  sections.Scope = sections.Scope.split('#### Estimate analysis')[0].trim() + `\n\n#### Confirmed decision\n\n[HUMAN-DECISION] 2026-10-17：用户回复“确认范围与 5 点”。${change.decision}\n\n#### Estimate analysis\n\n${change.analysis}`;
  sections.Estimate = '5'; sections['AI Ready'] = 'Yes'; sections.Dependencies = change.dependency;
  const body = Object.entries(sections).map(([name, value]) => `### ${name}\n\n${value}\n`).join('\n');
  const file = path.join(__dirname, `issue-${id}.md`);
  fs.writeFileSync(file, body);
  for (const mode of ['submission', 'execution']) execFileSync(process.execPath, ['.github/scripts/issue-contract.cjs', file, mode], { stdio: 'inherit' });
  execFileSync(process.execPath, ['.github/scripts/issue-submit.cjs', 'edit', '--issue', id, '--repo', 'TelyAgent/HireOSV2', '--body-file', file], { stdio: 'inherit', timeout: 60000 });
}
