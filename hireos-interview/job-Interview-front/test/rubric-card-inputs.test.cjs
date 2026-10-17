const { test } = require('node:test');
const assert = require('node:assert/strict');

test('#252: edit first/middle cards and append new cards without reordering or mutating existing cards', async () => {
  const { saveCardInputs } = await import('../src/features/project-intake/rubric-card-inputs.ts');
  const cards = [{ id: 'a', weight: 40 }, { id: 'b', weight: 30 }, { id: 'c', weight: 30 }];
  for (const id of ['a', 'b']) {
    const result = saveCardInputs(cards, { id, weight: 25 });
    assert.deepEqual(result.map(c => c.id), ['a', 'b', 'c']);
    assert.equal(result.find(c => c.id === id).weight, 25);
  }
  const added = saveCardInputs(cards, { requirement: 'New card', weight: 10 });
  assert.equal(added.length, 4);
  assert.deepEqual(added.slice(0, 3), cards);
  assert.equal(added[3].requirement, 'New card');
  assert.equal(saveCardInputs([], { requirement: 'First' }).length, 1);
  assert.deepEqual(cards.map(c => c.weight), [40, 30, 30]);
});
