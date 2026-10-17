import { apiFetch } from './shared';

export type BatchStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';
export interface ScreeningBatch {
  id: string;
  jobId: string;
  actorId: string;
  createdAt: string;
  cancelledAt: string | null;
  counts: Record<BatchStatus, number>;
  items: Array<{ id: string; applicationId: string; status: BatchStatus; attempt: number; evaluationId: string | null; errorCode: string | null }>;
}
export const listScreeningBatches = (jobId: string) => apiFetch<ScreeningBatch[]>(`/jobs/${encodeURIComponent(jobId)}/screening-batches`);
export const startScreeningBatch = (jobId: string, input: { idempotencyKey: string; applicationIds: string[] }) => apiFetch<ScreeningBatch>(`/jobs/${encodeURIComponent(jobId)}/screening-batches`, { method: 'POST', body: JSON.stringify(input) });
export const cancelScreeningBatch = (id: string) => apiFetch<ScreeningBatch>(`/screening-batches/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
export const reconcileScreeningBatch = (id: string) => apiFetch<ScreeningBatch>(`/screening-batches/${encodeURIComponent(id)}/reconcile`, { method: 'POST' });
export const retryScreeningBatchItem = (id: string, itemId: string, idempotencyKey: string) => apiFetch<ScreeningBatch>(`/screening-batches/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/retry`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) });
