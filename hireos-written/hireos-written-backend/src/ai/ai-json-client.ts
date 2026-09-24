import { ConfigService } from '@nestjs/config';
import type { ZodType } from 'zod';

// Ported from hireos-screening-backend/src/shared/ai-json-client.ts (same OpenAI-compatible
// provider, same HIREOS_AI_* env vars/account) -- kept as a per-service copy rather than a shared
// package, matching how every other cross-cutting piece in this estate is duplicated rather than
// factored out, since these services don't share a build/publish pipeline.
export class AiCallError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

function aiBaseUrl(config: ConfigService): string {
  return config.get<string>('HIREOS_AI_BASE_URL', '').trim();
}

function aiApiKey(config: ConfigService): string {
  return config.get<string>('HIREOS_AI_API_KEY', '').trim();
}

function aiModel(config: ConfigService): string {
  return config.get<string>('HIREOS_AI_MODEL', '').trim();
}

function aiTimeoutMs(config: ConfigService): number {
  return Number(config.get<string>('HIREOS_AI_TIMEOUT_SECONDS', '60')) * 1000;
}

export function isAiConfigured(config: ConfigService): boolean {
  return Boolean(aiBaseUrl(config) && aiApiKey(config) && aiModel(config));
}

export async function callAiForJson<T>(
  config: ConfigService,
  systemPrompt: string,
  userPrompt: string,
  schema: ZodType<T>,
  opts?: { maxCompletionTokens?: number },
): Promise<T> {
  if (!isAiConfigured(config)) throw new AiCallError('AI_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), aiTimeoutMs(config));
  let response: Response;
  try {
    response = await globalThis.fetch(`${aiBaseUrl(config).replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${aiApiKey(config)}` },
      body: JSON.stringify({
        model: aiModel(config),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        reasoning_effort: 'low',
        max_completion_tokens: opts?.maxCompletionTokens ?? 4000,
      }),
    });
  } catch (error) {
    throw new AiCallError(error instanceof Error ? error.message : 'AI_REQUEST_FAILED', error);
  } finally {
    globalThis.clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new AiCallError(`AI_HTTP_${response.status}: ${text.slice(0, 300)}`);
  }

  const body = (await response.json().catch((error) => {
    throw new AiCallError('AI_INVALID_RESPONSE_BODY', error);
  })) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const choice = body.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new AiCallError(choice?.finish_reason === 'length' ? 'AI_TRUNCATED_BEFORE_OUTPUT' : 'AI_EMPTY_RESPONSE');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new AiCallError('AI_INVALID_JSON', error);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new AiCallError(`AI_SCHEMA_MISMATCH: ${result.error.message}`);
  return result.data;
}
