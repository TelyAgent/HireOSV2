// #143 -- the batch lookup asks Core Record in groups of 100, and falls back to one-by-one against a Core Record
// from before #143, which ignores `ids` and answers with its directory.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CoreRecordClient } = require('../dist/core-record/core-record.client');

const identity = { workspaceId: 'w', actorId: 'a', roles: [] };
function client(handler) {
  const c = Object.create(CoreRecordClient.prototype);
  c.mode = 'remote';
  const calls = [];
  c.request = async (path) => { calls.push(path); return handler(path); };
  return { c, calls };
}
const ids = (n, p = 'j') => Array.from({ length: n }, (_, i) => `${p}${i}`);

test('groups of 100, deleted ids absent', async () => {
  const { c, calls } = client((path) => new URL(path, 'http://x').searchParams.get('ids').split(',').filter((id) => !id.endsWith('7')).map((id) => ({ id })));
  const found = await c.listJobsByIds(identity, ids(250));
  assert.equal(calls.length, 3);
  assert.equal(found.length, 225);
});

test('a Core Record ignoring ids is checked one job at a time', async () => {
  const { c, calls } = client((path) => (path.startsWith('/jobs?ids=') ? [{ id: 'newest-1' }, { id: 'newest-2' }] : path.endsWith('/a1') ? { id: 'a1' } : null));
  const found = await c.listJobsByIds(identity, ['a0', 'a1']);
  assert.deepEqual(found.map((j) => j.id), ['a1']);
  assert.deepEqual(calls, ['/jobs?ids=a0,a1', '/jobs/a0', '/jobs/a1']);
});
