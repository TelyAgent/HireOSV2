import { API_BASE_URL } from '../../utils/apiBase';

export type RecordNote = { content: string; version: number; updatedAt: string | null };
export type MeetingRecord = {
  session: { id: string; taskId: string; round: number; task: { job: { title: string }; candidate: { name: string } } };
  note: RecordNote;
  transcript: { status: 'unavailable'; code: string };
};

export async function recordApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}api${path}`, {
    ...options, cache: 'no-store', signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'x-hireos-record': '1', ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.code === 'string' ? body.code : 'RECORD_REQUEST_FAILED');
  return body;
}
