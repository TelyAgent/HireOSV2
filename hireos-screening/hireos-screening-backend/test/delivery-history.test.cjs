// Issue #26 AC-7 — delivery timeline steps carry an enum key the client localizes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serializeHistory, DELIVERY_HISTORY_STATES } = require('../dist/deliveries/deliveries.service');

test('entries written with a key keep it; the English text stays alongside', () => {
  const [entry] = serializeHistory([{ at: '2026-10-14T00:00:00.000Z', key: 'queued', state: 'Queued' }]);
  assert.deepEqual(entry, { at: '2026-10-14T00:00:00.000Z', key: 'queued', state: 'Queued' });
});

test('entries from before keys existed get their key back from the English text', () => {
  const legacy = Object.values(DELIVERY_HISTORY_STATES).map((state, i) => ({ at: `2026-10-1${i}T00:00:00.000Z`, state }));
  assert.deepEqual(serializeHistory(legacy).map((e) => e.key), Object.keys(DELIVERY_HISTORY_STATES));
});

test('unknown text gets no key rather than a wrong one; non-arrays become empty', () => {
  assert.equal(serializeHistory([{ at: 'x', state: 'Something else' }])[0].key, null);
  assert.equal(serializeHistory([{ at: 'x', key: 'bogus', state: 'Queued' }])[0].key, 'queued');
  assert.deepEqual(serializeHistory(null), []);
});
