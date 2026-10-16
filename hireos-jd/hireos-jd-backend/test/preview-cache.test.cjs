// #178 (review) -- a JD preview's reading is kept for the create that follows, but previews never created from
// don't pile up: expired readings go on the next preview, and there is a cap.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IntakeService } = require('../dist/intake/intake.service');

test('#178 (review): expired preview readings are dropped and the cache never grows past its cap', () => {
  const service = Object.create(IntakeService.prototype);
  Object.defineProperty(service, 'readings', { value: new Map() });
  const realNow = Date.now;
  try {
    let now = 1_000_000;
    Date.now = () => now;
    service.rememberReading('ws:a', { title: 'A' });
    now += 31 * 60 * 1000; // past the 30-minute window
    service.rememberReading('ws:b', { title: 'B' });
    assert.deepEqual([...service.readings.keys()], ['ws:b'], 'the expired reading is gone');
    for (let i = 0; i < 600; i++) service.rememberReading(`ws:${i}`, { title: String(i) });
    assert.equal(service.readings.size, 500);
    assert.ok(!service.readings.has('ws:b') && service.readings.has('ws:599'), 'the oldest go first');
  } finally {
    Date.now = realNow;
  }
});
