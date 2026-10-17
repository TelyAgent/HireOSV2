import { useEffect, useState } from 'react';
import { api } from './api';

type Report = { id: string; name: string; text: string; readStatus: string; state: string };
type Reports = { revision: number; needsResolution: boolean; currentId: string | null; reports: Report[]; history: { id: string; revision: number; actorId: string; createdAt: string; selectedMaterialId: string }[] };

export function ScreeningReports({ taskId, zh }: { taskId: string; zh: boolean }) {
  const [data, setData] = useState<Reports>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api<Reports>(`/tasks/${encodeURIComponent(taskId)}/screening-reports`)
      .then(value => {
        if (!value || !Array.isArray(value.reports) || !Array.isArray(value.history) || !Number.isInteger(value.revision)) throw new Error('Invalid report response');
        if (active) { setData(value); setError(''); }
      })
      .catch(() => { if (active) setError(zh ? '报告读取失败' : 'Could not load reports'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId, attempt, zh]);
  async function resolve() {
    if (!data || !selected || saving) return;
    setSaving(true); setError('');
    try {
      await api(`/tasks/${encodeURIComponent(taskId)}/screening-reports/resolve`, { method: 'POST', body: JSON.stringify({ materialId: selected, expectedRevision: data.revision }) });
      setEditing(false); setAttempt(n => n + 1);
    } catch {
      setError(zh ? '未能确认。请重新加载报告并核对后重试，选择已保留。' : 'Could not confirm. Reload reports and review before retrying; selection retained.');
    } finally { setSaving(false); }
  }
  const label = (state: string) => state === 'current' ? (zh ? '当前报告' : 'Current') : state === 'superseded' ? (zh ? '已替代' : 'Superseded') : (zh ? '待处理' : 'Unresolved');
  return <section data-testid="screening-reports" style={{ marginTop: 24, overflowWrap: 'anywhere', minWidth: 0 }}>
    <h2 style={{ fontSize: 16 }}>{zh ? '筛选报告版本' : 'Screening reports'}</h2>
    {error && <div role="alert">{error} <button type="button" disabled={saving || loading} onClick={() => setAttempt(n => n + 1)}>{zh ? '重新加载报告' : 'Reload reports'}</button></div>}
    {loading && <p role="status">{zh ? '加载中…' : 'Loading…'}</p>}
    {data && <>
      {data.needsResolution && <p>{zh ? '重复报告 · 待处理' : 'Duplicate · needs resolution'}</p>}
      {data.reports.length === 0 && <p>{zh ? '未提供筛选报告' : 'No screening reports'}</p>}
      {data.reports.map(report => <details key={report.id} style={{ marginBottom: 12 }}>
        <summary>{report.name} · {label(report.state)}</summary>
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{report.text || (zh ? '暂无可读取的文本' : 'No readable text available')}</div>
      </details>)}
      {data.needsResolution && !editing && <button type="button" disabled={loading} onClick={() => { setSelected(data.currentId ?? ''); setEditing(true); }}>{zh ? '处理重复报告' : 'Resolve'}</button>}
      {editing && <fieldset disabled={saving || loading} style={{ minWidth: 0 }}>
        <legend>{zh ? '选择当前报告' : 'Select current report'}</legend>
        {data.reports.map(report => <label key={report.id} style={{ display: 'block', marginBottom: 8 }}>
          <input type="radio" name={`screening-${taskId}`} value={report.id} checked={selected === report.id} onChange={() => setSelected(report.id)} /> {report.name}
        </label>)}
        <button type="button" onClick={() => setEditing(false)}>{zh ? '取消' : 'Cancel'}</button>{' '}
        <button type="button" disabled={!data.reports.some(r => r.id === selected)} onClick={() => void resolve()}>{zh ? '确认当前报告' : 'Confirm current report'}</button>
      </fieldset>}
      {data.history.length > 0 && <details><summary>{zh ? '处理历史' : 'Resolution history'}</summary>
        <ul>{data.history.map(event => <li key={event.id}>v{event.revision} · {data.reports.find(r => r.id === event.selectedMaterialId)?.name ?? event.selectedMaterialId} · {event.actorId} · {new Date(event.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US')}</li>)}</ul>
      </details>}
    </>}
  </section>;
}
