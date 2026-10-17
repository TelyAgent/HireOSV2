import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { api, ApiError, uploadMaterial, type Material } from './api';
import { errorText, intakeText } from './i18n';

export function LinkCandidateModal({ job, lang, onClose, onLinked }: {
  job: { id: string; title: string }; lang: 'en' | 'zh'; onClose: () => void; onLinked: () => void;
}) {
  const zh = lang === 'zh';
  const t = intakeText(lang);
  const [file, setFile] = useState<File>();
  const [material, setMaterial] = useState<Material>();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const submitting = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { generation.current++; }, []);

  async function upload(selected: File) {
    const current = ++generation.current;
    setFile(selected); setMaterial(undefined); setUploading(true); setError('');
    try {
      const result = await uploadMaterial(selected);
      if (current !== generation.current) return;
      if (result.errorCode || result.readStatus !== 'available') {
        setError(result.errorCode || 'MATERIAL_NOT_AVAILABLE');
      } else setMaterial(result);
    } catch (e) {
      if (current === generation.current) setError(e instanceof ApiError ? e.code : 'REQUEST_FAILED');
    } finally { if (current === generation.current) setUploading(false); }
  }

  async function link() {
    if (!material || uploading || submitting.current) return;
    submitting.current = true; setSaving(true); setError('');
    try {
      await api(`/jobs/${job.id}/tasks`, { method: 'POST', body: JSON.stringify({ materialId: material.id }) });
      onLinked();
    } catch (e) { setError(e instanceof ApiError ? e.code : 'REQUEST_FAILED'); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <Modal open title={zh ? '关联候选人' : 'Link candidate'} width={520}
    onCancel={() => { if (!submitting.current) onClose(); }}
    closable={!saving} maskClosable={!saving} keyboard={!saving}
    okText={zh ? '关联候选人' : 'Link candidate'} cancelText={t.cancel}
    onOk={() => void link()} confirmLoading={saving}
    okButtonProps={{ disabled: !material || uploading || saving }} cancelButtonProps={{ disabled: saving }}>
    <div style={{ overflowWrap: 'anywhere', marginBottom: 16 }}>
      <strong>{job.title}</strong><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{job.id}</div>
    </div>
    <div style={{ marginBottom: 8, fontWeight: 500 }}>{t.resume}</div>
    <Button type="primary" icon={<UploadOutlined aria-hidden />} disabled={saving} onClick={() => fileInput.current?.click()}>
      {file ? (zh ? '更换简历' : 'Replace resume') : (zh ? '选择简历' : 'Choose resume')}
    </Button>
    <input ref={fileInput} type="file" accept=".pdf,.docx,.txt" disabled={saving} hidden
      onChange={event => { const selected = event.target.files?.[0]; if (selected) void upload(selected); event.target.value = ''; }} />
    <p style={{ margin: '8px 0', overflowWrap: 'anywhere' }}>
      {file ? file.name : (zh ? '未选择文件' : 'No file selected')}
    </p>
    <div style={{ fontSize: 12, color: '#666' }}>PDF / DOCX / TXT · {zh ? '最大 10 MB' : 'Max 10 MB'}</div>
    {uploading && <p role="status">{t.uploading}</p>}
    {error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>
      {errorText(error, lang)}
      {!material && file && !uploading && <button onClick={() => void upload(file)} style={{ marginLeft: 8 }}>{t.retry}</button>}
    </div>}
  </Modal>;
}
