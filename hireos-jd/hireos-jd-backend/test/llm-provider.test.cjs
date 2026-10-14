// Issue #35 — jd-backend must boot without an AI key; only AI calls fail, with a clear code.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { LlmProvider } = require('../dist/copilot/llm-provider');

const isNotConfigured = (error) => error.getStatus() === 503 && error.response.code === 'AI_NOT_CONFIGURED';

test('AC-3: constructing the provider without HIREOS_AI_API_KEY does not throw (the app can start)', () => {
  for (const env of [{}, { HIREOS_AI_API_KEY: '' }, { HIREOS_AI_API_KEY: '   ' }]) {
    const provider = new LlmProvider(new ConfigService(env));
    assert.equal(provider.isConfigured(), false);
  }
});

test('AC-4: every AI call without a key fails with 503 AI_NOT_CONFIGURED, not a generic request failure', async () => {
  const provider = new LlmProvider(new ConfigService({}));
  await assert.rejects(provider.completeJson('system', [{ role: 'user', content: 'hi' }]), isNotConfigured);
  await assert.rejects(provider.answerWithWebSearch('instructions', 'question'), isNotConfigured);
  await assert.rejects(async () => {
    for await (const chunk of provider.streamJson('system', [{ role: 'user', content: 'hi' }])) void chunk;
  }, isNotConfigured);
});

test('with a key the provider reports itself configured', () => {
  assert.equal(new LlmProvider(new ConfigService({ HIREOS_AI_API_KEY: 'sk-test' })).isConfigured(), true);
});
