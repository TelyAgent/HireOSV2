// Reserved publisher branches fail closed rather than falling through to product QA.
module.exports = async ({ github, repo, pr }) => {
  if (!pr.head.ref?.startsWith('quality-ledger/')) return false;
  const source = /^quality-ledger\/pr-([1-9]\d*)$/.exec(pr.head.ref)?.[1];
  const fullName = `${repo.owner}/${repo.repo}`;
  const reports = new Set(['', '-review', '-qa'].map(suffix => `docs/quality/reports/PR-${source}${suffix}.md`));
  if (!source || pr.user?.login !== 'github-actions[bot]' || pr.user?.type !== 'Bot' ||
      pr.head.repo?.full_name !== fullName || pr.base.repo?.full_name !== fullName) {
    throw new Error('Invalid Quality Ledger PR provenance');
  }
  const files = await github.paginate(github.rest.pulls.listFiles, {
    ...repo, pull_number: pr.number, per_page: 100,
  });
  // GitHub caps this endpoint at 3000 files; never exempt a truncated response.
  if (!Number.isInteger(pr.changed_files) || pr.changed_files < 1 || pr.changed_files >= 3000 ||
      files.length !== pr.changed_files || new Set(files.map(f => f.filename)).size !== files.length ||
      !files.some(f => f.filename === `docs/quality/reports/PR-${source}.md`) ||
      files.some(f => !['added', 'modified'].includes(f.status) ||
        !(reports.has(f.filename) || /^docs\/quality\/bugs\/BUG-[1-9]\d*\.md$/.test(f.filename)))) {
    throw new Error('Invalid Quality Ledger PR file scope');
  }
  return true;
};
