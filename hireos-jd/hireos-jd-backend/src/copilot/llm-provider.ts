import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type WebSource = { title: string; url: string };
export type WebAnswer = { text: string; sources: WebSource[] };

@Injectable()
export class LlmProvider {
  private client: OpenAI | null = null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = config.get<string>('HIREOS_AI_MODEL', 'gpt-4o-mini');
  }

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('HIREOS_AI_API_KEY', '')?.trim());
  }

  /**
   * Created on first use (#35): without an API key the service still boots and serves every non-AI
   * route; only an AI call fails, with a clear AI_NOT_CONFIGURED instead of a crash at startup.
   */
  private requireClient(): OpenAI {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'AI is not configured on this server (HIREOS_AI_API_KEY is empty).' });
    }
    this.client ??= new OpenAI({
      apiKey: this.config.get<string>('HIREOS_AI_API_KEY'),
      baseURL: this.config.get<string>('HIREOS_AI_BASE_URL', 'https://api.openai.com/v1'),
      timeout: Number(this.config.get<string>('HIREOS_AI_TIMEOUT_SECONDS', '60')) * 1000,
    });
    return this.client;
  }

  async completeJson(system: string, turns: ChatTurn[]): Promise<string> {
    const client = this.requireClient();
    try {
      const completion = await client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'system', content: system }, ...turns],
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('LLM_EMPTY_RESPONSE');
      return content;
    } catch (error) {
      throw requestFailure(error);
    }
  }

  async *streamJson(system: string, turns: ChatTurn[]): AsyncGenerator<string, void, unknown> {
    const client = this.requireClient();
    try {
      const stream = await client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'system', content: system }, ...turns],
        response_format: { type: 'json_object' },
        stream: true,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    } catch (error) {
      throw requestFailure(error);
    }
  }

  /** Free-text answer with the provider's hosted web search tool; citations come back as `sources`. */
  async answerWithWebSearch(instructions: string, input: string): Promise<WebAnswer> {
    const client = this.requireClient();
    try {
      const response = await client.responses.create({
        model: this.model,
        instructions,
        input,
        tools: [{ type: 'web_search' }],
      });
      const sources = new Map<string, WebSource>();
      for (const item of response.output) {
        if (item.type !== 'message') continue;
        for (const part of item.content) {
          if (part.type !== 'output_text') continue;
          for (const annotation of part.annotations) {
            if (annotation.type !== 'url_citation') continue;
            const url = annotation.url.replace(/[?&]utm_source=openai$/, '');
            if (!sources.has(url)) sources.set(url, { title: annotation.title || new URL(url).hostname, url });
          }
        }
      }
      const text = stripInlineMarkdown(response.output_text);
      if (!text) throw new Error('LLM_EMPTY_RESPONSE');
      return { text, sources: [...sources.values()].slice(0, 5) };
    } catch (error) {
      throw requestFailure(error);
    }
  }
}

/** The chat renders plain text: drop inline citation links (listed separately as sources) and bold markers. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

/**
 * The provider's error as the API's. A request longer than the model's context is told apart (#145): retrying it
 * fails the same way, so the user is told to start a new conversation instead of being asked to retry.
 */
export function requestFailure(error: unknown): ServiceUnavailableException {
  const message = error instanceof Error ? error.message : 'LLM_REQUEST_FAILED';
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'context_length_exceeded' || /maximum context length|context[_ ]length|too many tokens/i.test(message)) {
    return new ServiceUnavailableException({ code: 'LLM_CONTEXT_TOO_LONG', message: 'This conversation is too long for AI to continue. Start a new conversation; the draft fields are saved.' });
  }
  return new ServiceUnavailableException({ code: 'LLM_REQUEST_FAILED', message });
}
