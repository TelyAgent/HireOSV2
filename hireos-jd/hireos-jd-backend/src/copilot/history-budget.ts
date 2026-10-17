import type { ChatTurn } from './llm-provider';
import type { JdFields } from './types';

/** Conversation rounds (one user message and one reply each) sent to the model as written (#145). */
export const HISTORY_ROUNDS = 10;
const HISTORY_MESSAGES = HISTORY_ROUNDS * 2;

type StoredMessage = { role: string; text: string | null; attachments: unknown };

/**
 * A conversation's stored messages as chat turns, bounded so a long conversation never outgrows the model's
 * context (#145): only the latest HISTORY_ROUNDS rounds go as written. The draft's fields hold what the older
 * rounds settled, so when anything is left out they stand in for it, marked as already confirmed.
 */
export function historyTurns(history: StoredMessage[], fields?: JdFields): ChatTurn[] {
  const kept = history.slice(-HISTORY_MESSAGES);
  const turns = kept.map((message): ChatTurn => {
    const isUpload = Array.isArray(message.attachments) && message.attachments.some((a) => asRecord(a).filename !== undefined);
    return { role: message.role as 'user' | 'assistant', content: isUpload ? '[已上传文件]' : message.text || '' };
  });
  const omitted = history.length - kept.length;
  if (!omitted) return turns;
  const known = fields && Object.keys(fields).length ? `\n当前草稿已有的字段（视为已确认，除非下面的对话改了它们）：\n${JSON.stringify(fields)}` : '';
  return [{ role: 'user', content: `（较早的 ${omitted} 条对话已省略。）${known}` }, ...turns];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
