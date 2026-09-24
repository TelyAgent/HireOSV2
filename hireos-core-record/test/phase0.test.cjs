const test = require('node:test');
const assert = require('node:assert/strict');

const { HealthService } = require('../dist/health/health.service');

test('phase 0 health payload identifies Core Record', () => {
  const payload = new HealthService().getHealth();
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'hireos-core-record');
  assert.equal(payload.phase, 'phase-0');
});
