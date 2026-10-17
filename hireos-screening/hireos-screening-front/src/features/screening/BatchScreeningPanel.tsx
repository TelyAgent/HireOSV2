import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/StoreContext';
import { Button, Badge } from '../../components/ui/Primitives';
import { Modal } from '../../components/ui/Overlays';
import { cancelScreeningBatch, listScreeningBatches, reconcileScreeningBatch, retryScreeningBatchItem, startScreeningBatch, type BatchStatus, type ScreeningBatch } from '../../data/api/screeningBatches';

type PendingStart = { idempotencyKey: string; applicationIds: string[]; sent: boolean };
const statuses: BatchStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled', 'unknown'];
const labels: Record<BatchStatus, [string, string]> = { queued: ['Queued', '排队中'], running: ['Running', '运行中'], completed: ['Completed', '已完成'], failed: ['Failed', '失败'], cancelled: ['Cancelled', '已取消'], unknown: ['Unknown', '结果未知'] };

export function BatchScreeningPanel({ jobId, chosen, names, onCompleted }: {
  jobId: string; chosen: string[]; names: Record<string, string>; onCompleted: () => void;
}) {
  const { state } = useStore();
  const zh = state.lang === 'zh';
  const storageKey = `screening-batch-start:${jobId}`;
  const [batches, setBatches] = useState<ScreeningBatch[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<PendingStart | null>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      return value && typeof value.idempotencyKey === 'string' && Array.isArray(value.applicationIds) && value.applicationIds.every((id: unknown) => typeof id === 'string') ? value : null;
    } catch { return null; }
  });
  const alive = useRef(true);
  const requestNumber = useRef(0);
  const completed = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const request = ++requestNumber.current;
    try {
      const next = await listScreeningBatches(jobId);
      if (!alive.current || request !== requestNumber.current) return;
      setBatches(next); setError('');
      const signature = next.flatMap(batch => batch.items.filter(item => item.status === 'completed').map(item => item.id)).sort().join(',');
      if (completed.current !== null && signature !== completed.current) onCompleted();
      completed.current = signature;
    } catch {
      if (alive.current && request === requestNumber.current) setError(zh ? '批次状态读取失败，当前数据可能过期。' : 'Could not load batch status. Displayed data may be outdated.');
    }
  }, [jobId, onCompleted, zh]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => { if (!busyRef.current) void refresh(); }, 5000);
    return () => { alive.current = false; clearInterval(timer); };
  }, [refresh]);

  function savePending(value: PendingStart | null) {
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); }
    catch { setError(zh ? '无法保存请求标识，请启用会话存储后重试。' : 'Could not preserve the request key. Enable session storage before retrying.'); return false; }
    setPending(value);
    return true;
  }
  async function action(work: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await work(); if (alive.current) await refresh(); }
    catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : (zh ? '操作失败，请重试。' : 'Request failed. Please retry.')); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  function prepare() {
    if (!pending?.sent && !savePending({ idempotencyKey: crypto.randomUUID(), applicationIds: [...chosen], sent: false })) return;
    setConfirming(true);
  }
  async function start() {
    if (!pending) return;
    await action(async () => {
      const request = { ...pending, sent: true };
      if (!savePending(request)) return;
      await startScreeningBatch(jobId, { idempotencyKey: request.idempotencyKey, applicationIds: request.applicationIds });
      if (alive.current) { savePending(null); setConfirming(false); }
    });
  }

  return <section aria-label={zh ? '批量筛选' : 'Batch screening'} style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '16px 0', margin: '16px 0', minWidth: 0, overflowWrap: 'anywhere' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <h3 style={{ margin: 0 }}>{zh ? '批量筛选' : 'Batch screening'}</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void refresh()}>{zh ? '刷新状态' : 'Refresh status'}</Button>
        <Button size="sm" variant="primary" disabled={busy || (!pending?.sent && !chosen.length)} onClick={prepare}>{pending?.sent ? (zh ? '核对启动请求' : 'Resume start request') : (zh ? `筛选所选 ${chosen.length} 人` : `Screen ${chosen.length} selected`)}</Button>
      </div>
    </div>
    {error && <p role="alert">{error}</p>}
    {batches === null ? <p role="status">{zh ? '正在读取批次…' : 'Loading batches…'}</p> : batches.length === 0 ? <p className="muted">{zh ? '暂无批次' : 'No batches yet'}</p> : batches.map(batch => <details key={batch.id} open={batches[0]?.id === batch.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <summary style={{ cursor: 'pointer' }}>{new Date(batch.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US')} · {batch.items.length} {zh ? '人' : 'candidates'} · {batch.id}</summary>
      <div aria-label={zh ? '批次计数' : 'Batch counts'} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0' }}>{statuses.map(status => <span key={status}>{labels[status][zh ? 1 : 0]}: {batch.counts[status]}</span>)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {batch.counts.queued > 0 && !batch.cancelledAt && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(() => cancelScreeningBatch(batch.id))}>{zh ? '取消排队项' : 'Cancel queued'}</Button>}
        {batch.counts.unknown > 0 && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(() => reconcileScreeningBatch(batch.id))}>{zh ? '核对未知结果' : 'Check unknown results'}</Button>}
      </div>
      {batch.counts.unknown > 0 && <p role="status">{zh ? '未知结果尚未确认，保留并发名额，不会自动重试。' : 'Unknown results remain unconfirmed and retain execution slots. They will not retry automatically.'}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>{batch.items.map(item => <li key={item.id} data-testid={`batch-item-${item.applicationId}`} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
        <Link to={`/applications/${item.applicationId}`} style={{ flex: '1 1 160px', minWidth: 0 }}>{names[item.applicationId] ?? item.applicationId}</Link>
        <Badge tone={item.status === 'completed' ? 'success' : item.status === 'failed' || item.status === 'unknown' ? 'warning' : 'info'}>{labels[item.status][zh ? 1 : 0]}</Badge>
        <span className="tiny">{zh ? '尝试' : 'Attempt'} {item.attempt}</span>
        {item.errorCode && <span className="tiny">{item.errorCode}</span>}
        {item.status === 'failed' && !batch.cancelledAt && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void action(() => retryScreeningBatchItem(batch.id, item.id, `attempt:${item.attempt}`))}>{zh ? '重试失败项' : 'Retry failed item'}</Button>}
      </li>)}</ul>
    </details>)}
    <Modal open={confirming} title={zh ? '确认批量筛选' : 'Confirm batch screening'} onClose={() => { if (!busy) setConfirming(false); }} footer={<Button variant="primary" disabled={busy} onClick={() => void start()}>{zh ? '确认启动' : 'Confirm start'}</Button>}>
      <p>{zh ? `固定选择 ${pending?.applicationIds.length ?? 0} 人` : `${pending?.applicationIds.length ?? 0} fixed candidates`}</p>
      <ul>{pending?.applicationIds.map(id => <li key={id}>{names[id] ?? id}</li>)}</ul>
      {error && <p role="alert">{error}</p>}
    </Modal>
  </section>;
}
