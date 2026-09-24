import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('SDK initializes before subscriptions and failures are redacted', async () => {
  const listeners = {};
  const messages = [];
  let initialized = false;
  let destroyed = false;
  const parent = { postMessage: message => messages.push(message) };
  const window = {
    addEventListener: (name, listener) => { listeners[name] = listener; },
    ZoomMtgEmbedded: {
      createClient: () => ({
        init: async options => {
          initialized = true;
          const video = options.customize.video;
          assert.equal(video.defaultViewType, 'gallery');
          assert.equal(video.popper.disableDraggable, true);
          assert.ok(video.viewSizes.default.height <= 500, 'reserve toolbar height');
          assert.ok(video.viewSizes.default.width <= 889, 'fit video aspect ratio');
          assert.ok(video.viewSizes.ribbon.width <= 316, 'ribbon is not full width');
          assert.equal(video.popper.anchorPosition.top, 0);
          assert.equal(video.popper.anchorPosition.left, Math.floor((900 - video.viewSizes.default.width) / 2));
          assert.ok(video.viewSizes.default.width * 274 / 250 + 112 <= 600, 'limited video mode fits without scrolling');
        },
        on: () => assert.ok(initialized, 'subscribe only after init'),
        join: async options => { assert.equal(options.zak, 'host-zak'); throw { errorCode: 3712, reason: 'Signature is invalid. sensitive-signature sensitive-password host-zak' }; },
        leaveMeeting: async () => {},
      }),
      destroyClient: () => { destroyed = true; },
    },
  };
  const context = { window, parent, SharedArrayBuffer: undefined, location: { origin: 'http://localhost' }, setTimeout, clearTimeout,
    ResizeObserver: class { observe() {} disconnect() {} },
    document: { documentElement: { clientWidth: 900, clientHeight: 600 }, createElement: () => ({}), head: { appendChild: tag => queueMicrotask(() => tag.onload()) }, getElementById: () => ({ clientWidth: 900, clientHeight: 600 }) },
  };
  vm.runInNewContext(fs.readFileSync(new URL('../public/zoom-meeting/meeting.js', import.meta.url), 'utf8'), context);
  await listeners.message({ origin: 'http://untrusted', source: parent, data: { channel: 'hireos-zoom', type: 'join' } });
  assert.equal(initialized, false);
  await listeners.message({ origin: 'http://localhost', source: parent, data: { channel: 'hireos-zoom', type: 'join', language: 'en-US', config: { meetingNumber: '12345678901', password: 'sensitive-password', signature: 'sensitive-signature', zak: 'host-zak' } } });
  const failure = messages.find(message => message.type === 'failed');
  assert.equal(failure.detail.stage, 'join');
  assert.equal(failure.detail.code, '3712');
  assert.ok(!JSON.stringify(failure).includes('sensitive-'));
  assert.ok(!JSON.stringify(failure).includes('host-zak'));
  assert.ok(destroyed);
});
