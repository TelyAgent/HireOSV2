// #231 -- a scheduled time is read in the round's chosen IANA time zone, so the instant stored doesn't depend on
// the browser's zone; daylight-saving gaps and repeats are reported, not guessed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const load = () => import(path.join(__dirname, '../src/lib/zonedTime.ts'));

test('#231 AC-1: Shanghai and New York wall times become the right instants, from a browser in any zone', async () => {
  const z = await load();
  assert.deepEqual(z.wallTimeToInstant('2026-10-15T10:00', 'Asia/Shanghai'), { kind: 'ok', iso: '2026-10-15T02:00:00.000Z' });
  assert.deepEqual(z.wallTimeToInstant('2026-10-15T10:00', 'America/New_York'), { kind: 'ok', iso: '2026-10-15T14:00:00.000Z' });
  // The issue's case: a New York browser scheduling 10:00 Shanghai time gets 02:00Z, not 14:00Z.
  const script = `import(${JSON.stringify(path.join(__dirname, '../src/lib/zonedTime.ts'))}).then((z) => console.log(JSON.stringify(z.wallTimeToInstant('2026-10-15T10:00', 'Asia/Shanghai'))))`;
  for (const tz of ['America/New_York', 'Asia/Shanghai', 'UTC']) {
    const out = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim();
    assert.deepEqual(JSON.parse(out), { kind: 'ok', iso: '2026-10-15T02:00:00.000Z' }, `browser in ${tz}`);
  }
});

test('#231 AC-2: reopening shows the same wall time; daylight-saving gaps and repeats get explicit feedback', async () => {
  const z = await load();
  assert.equal(z.instantToWallTime('2026-10-15T02:00:00.000Z', 'Asia/Shanghai'), '2026-10-15T10:00');
  assert.equal(z.instantToWallTime('2026-10-15T14:00:00.000Z', 'America/New_York'), '2026-10-15T10:00');
  assert.match(z.formatInZone('2026-10-15T02:00:00.000Z', 'Asia/Shanghai', 'en'), /10:00 AM GMT\+8/);
  assert.deepEqual(z.wallTimeToInstant('2026-03-08T02:30', 'America/New_York'), { kind: 'gap' });
  assert.deepEqual(z.wallTimeToInstant('2026-11-01T01:30', 'America/New_York'), { kind: 'overlap', earlier: '2026-11-01T05:30:00.000Z', later: '2026-11-01T06:30:00.000Z' });
  assert.deepEqual(z.wallTimeToInstant('2026-10-15 10:00', 'Asia/Shanghai'), { kind: 'invalid' });
});

test('#231 AC-3: old free-text labels are recognised as not a zone, so they are shown as labels, never used for math', async () => {
  const z = await load();
  assert.equal(z.isIanaZone('UTC+8'), false);
  assert.equal(z.isIanaZone('Beijing'), false);
  assert.equal(z.isIanaZone('Asia/Shanghai'), true);
  assert.equal(z.isIanaZone('UTC'), true);
});
