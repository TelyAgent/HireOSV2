function requireStages({ checks, classification, evidence, event, review }) {
  if (checks !== 'success' || classification !== 'success') throw new Error('Base checks and classification must pass');
  if (event === 'pull_request') {
    const expected = evidence === 'true' ? 'skipped' : 'success';
    if (!['true', 'false'].includes(evidence) || review !== expected) {
      throw new Error('Applicable pre-merge Review stage must pass');
    }
  }
}
module.exports = requireStages;
if (require.main === module) requireStages({ checks: process.env.CHECKS,
  classification: process.env.CLASSIFICATION, evidence: process.env.EVIDENCE,
  event: process.env.EVENT, review: process.env.REVIEW });
