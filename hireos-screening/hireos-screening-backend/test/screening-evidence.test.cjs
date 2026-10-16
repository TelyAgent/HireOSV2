// #192 -- a dimension's evidence comes back with the source material, résumé version, the excerpt and where it
// sits (page / paragraph); a quote the material doesn't contain, or a material that can't be read, is said to be
// unchecked — never shown as verified or as a blank drawer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { locateQuote } = require('../dist/shared/locate-quote');
const { ScreeningService } = require('../dist/screening/screening.service');

const segments = [
  { id: 's1', text: 'Mai Tran\nmai@example.test', page: 1 },
  { id: 's2', text: 'Senior Data Analyst, Example Retail — 2021-03 to present.', page: 1 },
  { id: 's3', text: 'Built pricing dashboards in SQL and Python for 120 stores.', page: 2 },
];

test('#192: a quote is located by paragraph, ignoring case and punctuation; a missing one is not', () => {
  assert.deepEqual(locateQuote(segments, 'BUILT pricing-dashboards in SQL and Python'), { segmentId: 's3', page: 2, paragraph: 1 });
  assert.deepEqual(locateQuote(segments, 'Senior Data Analyst — Example Retail'), { segmentId: 's2', page: 1, paragraph: 2 });
  assert.equal(locateQuote(segments, 'Led a team of 40 engineers'), null);
});

function service(materials) {
  const db = { material: { findMany: async ({ where }) => materials.filter((m) => where.id.in.includes(m.id)) } };
  return new ScreeningService(db, {});
}
const item = (id, statement, materialId = 'm-1') => ({ id, materialId, statement, sourceLabel: 'mai.pdf', kind: 'documented_fact', verification: 'unverified', confidence: 0.8, availability: 'available' });

test('#192 AC-1/AC-2: evidence carries its source, version and location, or says it could not be checked', async () => {
  const s = service([
    { id: 'm-1', name: 'mai.pdf', readStatus: 'available', segments, resumeVersion: { version: 2 } },
    { id: 'm-2', name: 'scan.pdf', readStatus: 'failed', segments: [], resumeVersion: { version: 1 } },
  ]);
  const evidence = await s['evidenceOf']('ws-1', { evidenceItems: [
    item('e1', 'Built pricing dashboards in SQL and Python for 120 stores.'),
    item('e2', 'Led a team of 40 engineers'),
    item('e3', 'Anything', 'm-2'),
  ] });
  assert.deepEqual(evidence.map((e) => [e.id, e.located, e.location?.page ?? null, e.location?.paragraph ?? null]), [
    ['e1', 'located', 2, 1], ['e2', 'not_located', null, null], ['e3', 'source_unavailable', null, null],
  ]);
  assert.equal(evidence[0].resumeVersion, 2);
  assert.equal(evidence[0].materialId, 'm-1');
  assert.equal(evidence[0].statement, 'Built pricing dashboards in SQL and Python for 120 stores.');
  assert.ok(evidence.every((e) => e.verification === 'unverified'), 'nothing is claimed verified');
});

test('#192 AC-3: an evaluation without evidence returns none (no reference is counted on its own)', async () => {
  assert.deepEqual(await service([])['evidenceOf']('ws-1', { evidenceItems: [] }), []);
});
