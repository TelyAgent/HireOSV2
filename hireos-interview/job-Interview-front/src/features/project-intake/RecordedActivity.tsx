import { useEffect, useState } from 'react';
import { api } from './api';

type Activity = { id: string; actorId: string; createdAt: string; event: string };

export function RecordedActivity({ taskId, zh }: { taskId: string; zh: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ taskId: string; items?: Activity[]; failed?: boolean }>();
  useEffect(() => {
    let cancelled = false;
    setResult({ taskId });
    api<Activity[]>(`/tasks/${encodeURIComponent(taskId)}/activity`)
      .then(items => { if (!cancelled) setResult({ taskId, items }); })
      .catch(() => { if (!cancelled) setResult({ taskId, failed: true }); });
    return () => { cancelled = true; };
  }, [taskId, attempt]);
  const current = result?.taskId === taskId ? result : undefined;
  const labels: Record<string, string> = {
    review_recorded: zh ? '审阅已记录' : 'Review recorded',
    decision_recorded: zh ? '决定已记录' : 'Decision recorded',
  };
  return <section data-testid="recorded-activity" style={{ marginTop: 24, minWidth: 0, overflowWrap: 'anywhere' }}>
    <h2 style={{ fontSize: 16 }}>{zh ? '已记录的近期活动' : 'Recorded recent activity'}</h2>
    {current?.failed ? <div role="alert">{zh ? '活动读取失败。' : 'Could not load activity.'} <button type="button" onClick={() => setAttempt(n => n + 1)}>{zh ? '重试' : 'Retry'}</button></div>
      : !current?.items ? <p role="status">{zh ? '加载中…' : 'Loading…'}</p>
      : current.items.length === 0 ? <p>{zh ? '暂无已记录的活动' : 'No recorded activity yet'}</p>
      : <ul style={{ paddingLeft: 20 }}>{current.items.map(item => <li key={item.id} style={{ marginBottom: 12 }}>
        <div>{labels[item.event] ?? (zh ? '未知活动类型' : 'Unknown activity type')}</div>
        <div>{item.actorId || (zh ? '操作人未记录' : 'Actor not recorded')} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US')}</time></div>
      </li>)}</ul>}
  </section>;
}
