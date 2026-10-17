const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { inspectIssue } = require('../../.github/scripts/issue-contract.cjs');
const issue = JSON.parse(execFileSync('gh', ['api', 'repos/TelyAgent/HireOSV2/issues/287'], { encoding: 'utf8', timeout: 30000 }));
const comments = JSON.parse(execFileSync('gh', ['api', '--paginate', '--slurp', 'repos/TelyAgent/HireOSV2/issues/287/comments?per_page=100'], { encoding: 'utf8', timeout: 30000 })).flat();
fs.writeFileSync(path.join(__dirname, 'issue-287-before.json'), JSON.stringify({ issue, comments }, null, 2));
const { sections, errors } = inspectIssue(issue.body);
if (errors.length) throw Error(errors.join('; '));
if (sections.Screenshot) { sections.References += `\n\n#### Screenshot\n\n${sections.Screenshot}`; delete sections.Screenshot; }
sections.Scope += '\n\n#### Confirmed decision\n\n[HUMAN-DECISION] 2026-10-17 用户确认范围与 3 点：先填必需的推荐理由，再点击推荐选项立即一起保存；可单独保存理由修改，取消推荐时清空理由；刷新后保留，失败保留输入，历史缺失显示未记录。复用现有轮次接口，不新增整体 Scorecard 提交流程。\n\n#### Estimate analysis\n\n3 点，Owner 已确认。复用单轮次 recommendation PATCH/读取与现有 Review 控件，新增可空历史字段和服务端非空校验；覆盖 AC-1 空白/有效理由和取消、AC-2 刷新/轮次隔离、AC-3 数据库/API/浏览器回归。涉及数据迁移与前后端，不是 1/2 点的纯展示修正；不承担整体 Scorecard 提交、修订工作流或跨服务联动，低于 5 点。采用起始尺度，无已验收同类历史点数参照。';
sections.Dependencies = '保存时机已由 Owner 确认：随推荐立即保存，不依赖整体 Scorecard 提交流程。';
sections.Estimate = '3'; sections['AI Ready'] = 'Yes';
sections['Acceptance Criteria'] = sections['Acceptance Criteria'].replace(/^AC-(\d+)：/gm, '- AC-$1:');
const file = path.join(__dirname, 'issue-287.md');
fs.writeFileSync(file, Object.entries(sections).map(([name, value]) => `### ${name}\n\n${value}\n`).join('\n'));
for (const mode of ['submission', 'execution']) execFileSync(process.execPath, ['.github/scripts/issue-contract.cjs', file, mode], { stdio: 'inherit' });
execFileSync(process.execPath, ['.github/scripts/issue-submit.cjs', 'edit', '--issue', '287', '--repo', 'TelyAgent/HireOSV2', '--body-file', file], { stdio: 'inherit', timeout: 60000 });
