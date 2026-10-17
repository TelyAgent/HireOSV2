// Issue #145 — a conversation too long for the model gets its own message: retrying would fail the same way.
import { describe, expect, it } from 'vitest';
import { CopilotRequestError } from '../src/features/copilot/copilotApi';
import { CONTEXT_TOO_LONG, describeCopilotError } from '../src/features/copilot/copilotErrors';
import { ZH as zh } from '../src/data/i18n';

describe('conversation context budget (#145)', () => {
  it('LLM_CONTEXT_TOO_LONG says to start a new conversation instead of retrying', () => {
    const text = describeCopilotError(new CopilotRequestError(503, { code: 'LLM_CONTEXT_TOO_LONG', message: 'too long' }));
    expect(text).toBe(CONTEXT_TOO_LONG);
    expect(text).not.toMatch(/retry/i);
  });

  it('other 503s still ask to retry', () => {
    expect(describeCopilotError(new CopilotRequestError(503, { code: 'LLM_REQUEST_FAILED', message: 'x' }))).toMatch(/retry/);
  });

  it('the new messages have Chinese translations', () => {
    expect(zh[CONTEXT_TOO_LONG]).toMatch(/新的对话/);
  });
});
