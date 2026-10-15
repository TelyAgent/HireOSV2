// My Tasks keeps each case's job in step with Core Record -- e.g. a location JD's AI structuring
// filled in after the case was created from the new-task entry.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TasksService } = require('../dist/tasks/tasks.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };

test('job fields changed in Core Record are copied to the local job; Core being down is harmless', async () => {
  const job = { id: 'local-job', coreJobId: 'core-job', title: 'Payments Engineer', department: null, location: null, level: null };
  const updates = [];
  const db = {
    job: { findMany: async () => [job], update: async ({ where, data }) => { updates.push({ id: where.id, data }); } },
    task: { findMany: async () => [] },
  };
  const core = { listJobs: async () => [{ id: 'core-job', title: 'Payments Engineer', location: 'Hangzhou', team: 'Payments', status: 'draft' }] };
  await new TasksService(db, core).list(identity);
  assert.deepEqual(updates, [{ id: 'local-job', data: { title: 'Payments Engineer', department: 'Payments', location: 'Hangzhou', level: null } }]);

  updates.length = 0;
  const down = { listJobs: async () => { throw new Error('CORE_RECORD_UNAVAILABLE'); } };
  assert.deepEqual(await new TasksService(db, down).list(identity), []);
  assert.equal(updates.length, 0);
});
