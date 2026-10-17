const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { extractTextFromLink } = require('../dist/copilot/link-extract');

test('#85: unsupported URLs never reach conversation writes, AI, jobs or outbound reads', async () => {
  const unexpected = new Proxy({}, { get: (_, name) => { throw new Error(`Unexpected access: ${String(name)}`); } });
  const service = new CopilotService(unexpected, unexpected, unexpected, unexpected, unexpected);
  for (const url of ['file:///tmp/uj-test-m4.txt', 'ftp://example.com/jd']) {
    for (const body of [{ url }, { text: url }]) {
      await assert.rejects(service.importSource({ workspaceId: 'ws', actorId: 'actor' }, 'conversation', body, { idempotencyKey: 'test' }), error => {
        // Short text may fail the existing input length guard before classification.
        if (error.name === 'ZodError') return true;
        assert.equal(error.getStatus(), 400);
        assert.equal(error.getResponse().code, 'UNSUPPORTED_LINK_PROTOCOL');
        return true;
      });
    }
    let requests = 0;
    await assert.rejects(extractTextFromLink(url, { renderer: null, network: {
      lookup: async () => { requests++; return []; },
      fetch: async () => { requests++; throw new Error('Unexpected read'); },
    } }), /http/);
    assert.equal(requests, 0);
  }
});
