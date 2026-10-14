// Issue #35 AC-4 — without an AI key the backend answers 503 AI_NOT_CONFIGURED; the panel says so plainly.
import { describe, expect, it } from 'vitest';
import { CopilotRequestError } from '../src/features/copilot/copilotApi';
import { describeCopilotError } from '../src/features/copilot/copilotErrors';

describe('AI not configured (#35)', () => {
  it('explains that AI is off and points to manual creation — no code, no env var name', () => {
    const text = describeCopilotError(new CopilotRequestError(503, { code: 'AI_NOT_CONFIGURED', message: 'AI is not configured on this server (HIREOS_AI_API_KEY is empty).' }));
    expect(text).toMatch(/AI isn’t set up/);
    expect(text).toMatch(/Create Manually/);
    expect(text).not.toMatch(/AI_NOT_CONFIGURED|HIREOS_AI_API_KEY|503/);
  });
});
