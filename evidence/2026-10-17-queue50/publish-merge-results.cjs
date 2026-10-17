// Run only after the user-authorized direct merge is present on origin/main.
const { execFileSync } = require('node:child_process');
const manifest = require('./merge-disposition.json');
const sha = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw Error('Pass the verified merge SHA');
execFileSync('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
const repo = 'TelyAgent/HireOSV2';
const evidence = `https://github.com/${repo}/tree/${sha}/evidence/2026-10-17-queue50`;
const gh = args => execFileSync('gh', args, { encoding: 'utf8', timeout: 45000 });
for (const [kind, entries] of Object.entries(manifest)) {
  for (const [number, detail] of Object.entries(entries)) {
    const issue = JSON.parse(gh(['api', `repos/${repo}/issues/${number}`]));
    const comments = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/issues/${number}/comments?per_page=100`])).flat();
    if (issue.state !== 'open') { console.log(`#${number} already ${issue.state}; unchanged`); continue; }
    const marker = `merge-checkpoint:${sha}:${number}`;
    const body = `[AI-RESULT]\n\n${kind === 'close' ? '已完成确认范围，按用户本次授权关闭。\n\n' + detail : '部分修复，本项保持 OPEN。\n\n已完成：' + detail[0] + '。\n\n尚未完成：' + detail[1] + '。'}\n\n代码已提交、合并并推送 main：${sha}\n验证与证据：${evidence}（merge-results.json、merge-summary.md 及各项本地验收记录）。\n\n这是本地验证与代码合并结果，不表示已部署生产。数据库迁移和兼容部署要求见证据；未改写生产候选人记录。\n\n<!-- ${marker} -->`;
    if (!comments.some(c => c.body?.includes(marker))) gh(['api', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`, '--jq', '.html_url']);
    if (kind === 'close') gh(['api', '-X', 'PATCH', `repos/${repo}/issues/${number}`, '-f', 'state=closed', '-f', 'state_reason=completed', '--jq', '.state']);
    console.log(`#${number}: ${kind === 'close' ? 'closed' : 'commented, kept open'}`);
  }
}
