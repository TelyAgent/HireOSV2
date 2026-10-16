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

  // One budget for the whole exchange (#120): the request, the response headers and reading the full body. A
  // provider that sends headers quickly and then trickles the body is cut off at the same limit. Aborting stops
  // this client only; the provider may still finish its own work.
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), aiTimeoutMs(config));
  const failure = (error: unknown, fallback: string) =>
    controller.signal.aborted ? new AiCallError('AI_TIMEOUT', error) : new AiCallError(error instanceof Error ? error.message : fallback, error);
  let response: Response;
  let body: { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  try {
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
      throw failure(error, 'AI_REQUEST_FAILED');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (controller.signal.aborted) throw new AiCallError('AI_TIMEOUT');
      throw new AiCallError(`AI_HTTP_${response.status}: ${text.slice(0, 300)}`);
    }

    body = (await response.json().catch((error) => {
      throw controller.signal.aborted ? new AiCallError('AI_TIMEOUT', error) : new AiCallError('AI_INVALID_RESPONSE_BODY', error);
    })) as typeof body;
  } finally {
    globalThis.clearTimeout(timeout);
  }
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
