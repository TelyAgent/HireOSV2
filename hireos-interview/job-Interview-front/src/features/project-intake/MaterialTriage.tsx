import { useState } from 'react';
import { api, type Task } from './api';

const control = { border: '1px solid var(--line)', borderRadius: 4, padding: '6px 10px', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer' };

export function MaterialTriage({ taskId, materials, zh, onChanged }: {
  taskId: string; materials: Task['materials']; zh: boolean; onChanged: () => Promise<void>;
}) {
  return <section data-testid="material-triage" style={{ marginTop: 24, minWidth: 0, overflowWrap: 'anywhere' }}>
    <h2 style={{ fontSize: 16 }}>{zh ? '未归类附件' : 'Unassigned attachments'}</h2>
    {materials.filter(m => m.kind === 'other').length === 0 && <p>{zh ? '暂无待归类附件' : 'No attachments need triage'}</p>}
    {materials.filter(m => m.kind === 'other').map(item => <TriageItem key={item.material.id} taskId={taskId} item={item} zh={zh} onChanged={onChanged} />)}
  </section>;
}

function TriageItem({ taskId, item, zh, onChanged }: { taskId: string; item: Task['materials'][number]; zh: boolean; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (busy || !kind) return;
    setBusy(true); setError('');
    try {
      await api(`/tasks/${encodeURIComponent(taskId)}/materials/triage`, { method: 'POST', body: JSON.stringify({ materialId: item.material.id, kind }) });
      await onChanged();
      setOpen(false);
    } catch {
      setError(zh ? '归类或刷新失败，选择已保留。请刷新核对最新状态后重试。' : 'Classification or refresh failed; selection retained. Refresh to check the latest state before retrying.');
    } finally { setBusy(false); }
  }
  return <div data-testid={`triage-${item.material.id}`} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
    <div>{item.material.name}</div>
    <p>{zh ? '未归类 · 待处理' : 'Unassigned · needs triage'}</p>
    {error && <p role="alert">{error}</p>}
    {!open ? <button type="button" style={control} onClick={() => setOpen(true)}>{zh ? '归类' : 'Triage'}</button> : <fieldset disabled={busy} style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <legend>{zh ? '材料类型' : 'Material type'}</legend>
      <label>{zh ? '选择类型' : 'Select type'}{' '}<select style={{ ...control, maxWidth: '100%' }} value={kind} onChange={e => setKind(e.target.value)}>
        <option value="">{zh ? '请选择' : 'Choose type'}</option>
        <option value="screening">{zh ? '筛选报告' : 'Screening report'}</option>
        <option value="assessment">{zh ? '测评报告' : 'Assessment report'}</option>
      </select></label>{' '}
      <button type="button" style={control} onClick={() => setOpen(false)}>{zh ? '取消' : 'Cancel'}</button>
      <button type="button" style={{ ...control, background: 'var(--brand)', color: 'white', opacity: !kind || busy ? 0.5 : 1 }} disabled={!kind} onClick={() => void confirm()}>{zh ? '确认归类' : 'Confirm classification'}</button>
    </fieldset>}
  </div>;
}
