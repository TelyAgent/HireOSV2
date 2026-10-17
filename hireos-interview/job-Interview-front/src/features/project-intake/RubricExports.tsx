import { useEffect, useRef, useState } from 'react';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { api, downloadApi, type RubricVersion } from './api';

type ExportRecord = { id: string; actorId: string; revision: number; versionNumber: number; rubricStatus: string; status: string; errorCode: string | null; createdAt: string };

export function RubricExports({ jobId, rubric, zh }: { jobId: string; rubric: RubricVersion; zh: boolean }) {
  const [records, setRecords] = useState<ExportRecord[]>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef<{ id: string; revision: number; rubricId: string } | undefined>(undefined);
  useEffect(() => {
    let active = true;
    api<ExportRecord[]>(`/jobs/${jobId}/rubric/exports`).then(rows => { if (active) { setRecords(rows); setError(''); } })
      .catch(() => { if (active) setError(zh ? '生成记录读取失败' : 'Could not load generation records'); });
    return () => { active = false; };
  }, [jobId, attempt, zh]);
  async function generate() {
    if (busy) return;
    if (!request.current || request.current.revision !== rubric.version || request.current.rubricId !== rubric.id) {
      request.current = { id: crypto.randomUUID(), revision: rubric.version, rubricId: rubric.id };
    }
    setBusy(true); setError('');
    try {
      const result = await api<ExportRecord>(`/jobs/${jobId}/rubric/exports`, { method: 'POST', body: JSON.stringify({ requestId: request.current.id, rubricId: rubric.id, revision: rubric.version }) });
      if (result.status !== 'pending') request.current = undefined;
      setRecords(rows => [result, ...(rows ?? []).filter(r => r.id !== result.id)]);
    } catch (e) {
      setError((e as { code?: string }).code === 'RUBRIC_EXPORT_STALE'
        ? (zh ? '评分标准已变化，请刷新核对后再导出。' : 'Rubric changed. Refresh and review before exporting.')
        : (zh ? '生成请求未确认，可重试同一请求或刷新记录核对。' : 'Generation request unconfirmed. Retry the same request or refresh records.'));
    } finally { setBusy(false); }
  }
  async function download(record: ExportRecord) {
    try {
      const blob = await downloadApi(`/jobs/${jobId}/rubric/exports/${record.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `rubric-v${record.versionNumber}-r${record.revision}.pdf`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError(zh ? '文件获取失败，生成记录不变，可重试下载。' : 'File retrieval failed; generation record unchanged. Retry download.'); }
  }
  return <section data-testid="rubric-exports" style={{ margin: '16px 0', overflowWrap: 'anywhere' }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Button style={{ maxWidth: '100%', height: 'auto', minHeight: 32, whiteSpace: 'normal' }} icon={<DownloadOutlined />} loading={busy} onClick={() => void generate()}>{zh ? '导出已保存版本 PDF' : 'Export saved version PDF'}</Button>
      <Tooltip title={zh ? '刷新生成记录' : 'Refresh generation records'}><Button aria-label={zh ? '刷新生成记录' : 'Refresh generation records'} icon={<ReloadOutlined />} onClick={() => setAttempt(n => n + 1)} /></Tooltip>
    </div>
    {error && <p role="alert">{error}</p>}
    <details><summary>{zh ? 'PDF 生成记录' : 'PDF generation records'}</summary>
      {!records ? <p>{zh ? '加载中…' : 'Loading…'}</p> : records.length === 0 ? <p>{zh ? '暂无生成记录' : 'No generation records'}</p> : <ul style={{ paddingLeft: 18 }}>
        {records.map(record => <li key={record.id} style={{ marginTop: 10 }}>
          <div>v{record.versionNumber} / r{record.revision} · {record.rubricStatus} · {record.actorId} · {new Date(record.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US')}</div>
          <div>{record.status === 'succeeded' ? (zh ? '已生成' : 'Generated') : record.status === 'failed' ? (zh ? '生成失败' : 'Generation failed') : (zh ? '生成尚未确认' : 'Generation not confirmed')}
            {record.status === 'succeeded' && <Tooltip title={zh ? '下载 PDF' : 'Download PDF'}><Button aria-label={zh ? '下载 PDF' : 'Download PDF'} icon={<DownloadOutlined />} onClick={() => void download(record)} /></Tooltip>}
          </div>
        </li>)}
      </ul>}
    </details>
  </section>;
}
