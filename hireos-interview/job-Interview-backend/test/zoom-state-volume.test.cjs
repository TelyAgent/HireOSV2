// #117 -- the Zoom OAuth accounts, their encryption key and meeting mappings live in one directory
// (/app/.local/zoom in the container, now a named volume): a new instance on the same directory — a recreated
// container — reads them back; an empty one says to reconnect instead of claiming a connection.
require('reflect-metadata');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readdir, readFile, stat, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { ZoomHostService } = require('../dist/meetings/zoom-host.service');
const { MeetingsService } = require('../dist/meetings/meetings.service');

const identity = { workspaceId: 'test', actorId: 'actor' };
const config = { get: (key) => ({ NODE_ENV: 'development', ZOOM_DEV_ENABLED: 'true', ZM_RTMS_CLIENT: 'rtms-client-id', ZM_RTMS_SECRET: 'rtms-client-secret', ZOOM_OAUTH_PUBLIC_CLIENT_ID: 'public-id', ZOOM_OAUTH_CALLBACK_PORT: '50592', ZOOM_MEETING_SDK_CLIENT_ID: 'sdk-id', ZOOM_MEETING_SDK_CLIENT_SECRET: 'sdk-secret' })[key] };
const instance = (directory) => { const s = new ZoomHostService(config, new MeetingsService(config)); s.directory = directory; return s; };

test('#117 AC-1/AC-2: a recreated container on the same volume reads the account and meeting back; an empty volume asks to reconnect', async () => {
  const volume = await mkdtemp(join(tmpdir(), 'hireos-zoom-volume-'));
  try {
    const before = instance(volume);
    const owner = before.owner(identity);
    await before.save(owner, { clientId: 'public-id', access: 'synthetic-access', refresh: 'synthetic-refresh', expires: Date.now() + 3600_000, id: 'zoom-user', name: 'Test host',
      meetings: { default: { id: 12345678901, password: 'synthetic-passcode', joinUrl: 'https://zoom.us/j/12345678901' } } });
    before.onModuleDestroy();

    // The container is recreated: a new process, the same volume.
    const after = instance(volume);
    const status = await after.status(identity);
    assert.deepEqual([status.connected, status.name, status.meeting], [true, 'Test host', { meetingNumber: 12345678901, joinUrl: 'https://zoom.us/j/12345678901' }]);
    after.onModuleDestroy();

    // Stored encrypted with the key on the same volume: no token in clear, owner-only permissions.
    for (const file of await readdir(volume)) {
      const content = await readFile(join(volume, file));
      assert.ok(!content.includes('synthetic-access') && !content.includes('synthetic-refresh'), file);
      assert.equal((await stat(join(volume, file))).mode & 0o777, 0o600, file);
    }
    assert.equal((await stat(volume)).mode & 0o777, 0o700);

    // State lost (no volume): not connected, so the user reconnects — never a false "connected".
    const empty = await mkdtemp(join(tmpdir(), 'hireos-zoom-empty-'));
    const fresh = instance(join(empty, 'zoom'));
    const lost = await fresh.status(identity);
    assert.deepEqual([lost.connected, lost.meeting], [false, null]);
    fresh.onModuleDestroy();
    await rm(empty, { recursive: true, force: true });
  } finally {
    await rm(volume, { recursive: true, force: true });
  }
});
