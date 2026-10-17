const { execFileSync } = require('node:child_process');
const sha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('Provide the pushed main merge SHA');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('rev-parse', 'origin/main') !== sha) throw Error('Merge SHA does not match fetched origin/main');
const repo = 'TelyAgent/HireOSV2';
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).trim();
const entries = [
  [198, false, '部分修复，保持 OPEN。本次合并前回归发现加载阶段滚动事件覆盖返回位置，现已修复：离开时捕获实际位置，返回加载中不覆盖；原刷新回顶部、返回精确恢复及空结果断言通过。尚未完成 AC-3：维度过滤口径及全部过滤组合验收，未借本次修复关闭本项。', 'merge-batch-summary.md'],
  [215, true, '所有正式决定要求当前已完成评估；缺失、stale、running 均拒绝，依据 ID/版本/时间可查，失败保留输入。AC-1 至 AC-4 已本地验证。', 'next-215-216.md'],
  [216, true, '评估及决定版本前置条件、同人同内容同版本幂等重试、不同人/内容冲突、并发及撤回后旧页面保护已完成。AC-1 至 AC-4 已本地验证。', 'next-215-216.md'],
  [243, true, 'Overview 展示已有真实 Revision，支持加载/空状态/失败重试及项目切换保护；工作区隔离与敏感 payload 排除已验证。AC-1 至 AC-3 完成。范围不含完整 I13。', 'next-243.md'],
  [246, true, '重复筛选报告人工 Resolve、当前/旧报告保留、操作审计、幂等与成员版本冲突保护完成；旧评分/已发布包不变。AC-1 至 AC-3 完成。', 'next-246.md'],
  [247, true, 'other 附件独立展示，仅允许人工归为 screening/assessment；原子归类审计、重复报告联动、并发/隔离/回滚及浏览器回读验证完成。AC-1 至 AC-3 完成。', 'next-247.md'],
  [251, true, '能力卡来源按生成时 JD 输入快照、版本、分段及原文校验；修改要求清除旧引用，历史不可验证来源显示未记录。AC-1 至 AC-3 完成。', 'next-251-365-200.md'],
  [365, true, '题目草稿、直接发布、不可变版本历史、发布幂等、计划选用门禁与旧邀请快照回归完成；历史迁移只保留现存内容，不补造旧版本。AC-1 至 AC-4 完成。', 'next-251-365-200.md'],
  [368, true, '题目停用及版本/操作人/时间审计、幂等与冲突保护、新计划禁用、编辑后显式发布新版本、旧邀请保持不变已验证。AC-1 至 AC-3 完成。', 'next-368.md'],
  [424, true, '持久批次/条目、冻结输入、跨进程每工作区最多两项、排队取消、明确失败项幂等人工重试与未知结果核对完成。AC-1 至 AC-6 完成；未知结果不自动重跑，也不承诺外部 exactly-once。', 'next-251-365-200.md'],
  [425, true, '工作台固定选择、持久进度、取消/失败重试/未知核对、丢响应刷新恢复、桌面/窄屏及实际 Nest+隔离 PostgreSQL 浏览器 E2E 完成。AC-1 至 AC-5 完成，成功项未重复分析。', 'next-251-365-200.md'],
  [200, true, '两个子项 #424/#425 已分别完成并合并，父项 AC-1 至 AC-6 已有执行层、工作台和端到端证据。按已批准范围关闭汇总父项，不重复累计点数。', 'next-251-365-200.md'],
  [426, true, '管理员显式初始账号关联、同工作区有效成员服务端校验、审计、幂等/并发保护、数据库迁移及浏览器验收完成。AC-1 至 AC-4 完成；不含解绑/换绑或评分卡提交功能。', 'next-426.md'],
  [253, false, '部分修复，保持 OPEN。已完成 AC-1/2/3：草稿/确认版 PDF 冻结快照、版本过期保护、持久生成记录与查询、失败和多页 PDF 验证。尚未完成 AC-4：完整 I13 Activity/DownloadAttempt 接入；生成成功不等于用户下载成功。', 'next-253-phase1.md'],
  [283, false, '保持 OPEN。已完成前置 #426 显式账号关联，并确认本项范围与 8 点。尚未完成：独立评分卡提交、不可变提交版本、原提交人修订、本人待办计数及下游仅读取已提交版本。不能把前置关联完成算作本项修复。', 'estimate-283-284.md'],
  [284, false, '部分修复，保持 OPEN。此前已完成 AC-1 的 Interview completed / 面试完成于文案。尚未完成 AC-2/3：依赖 #283 的真实草稿/已提交/修订草稿状态与浏览器回归；本次仅记录已确认剩余 2 点及依赖，不将其关闭。', 'issue-284.md'],
];
for (const [number, close, detail, evidence] of entries) {
  const marker = `<!-- merge-batch:${sha}:${number} -->`;
  const current = JSON.parse(gh('issue', 'view', String(number), '--repo', repo, '--json', 'state,comments'));
  const body = `[AI-RESULT]\n\n${detail}\n\n代码已提交、合并并推送 main：${sha}\n验收记录：https://github.com/${repo}/blob/${sha}/evidence/2026-10-17-queue50/${evidence}\n合并前统一复跑：https://github.com/${repo}/blob/${sha}/evidence/2026-10-17-queue50/merge-batch-results.json\n\n这是本地验收与代码合并结果，不表示生产部署。未提 PR，未把未执行的 CI/QA 声称为通过。迁移及兼容要求见记录；原记录中“未提交/未合并”描述是实施时状态，以本评论为准。\n\n${marker}`;
  if (!current.comments.some(c => c.body.includes(marker))) gh('issue', 'comment', String(number), '--repo', repo, '--body', body);
  if (close && current.state === 'OPEN') gh('issue', 'close', String(number), '--repo', repo, '--reason', 'completed');
  console.log(`#${number}: ${close ? 'closed' : 'kept open'} with result`);
}
