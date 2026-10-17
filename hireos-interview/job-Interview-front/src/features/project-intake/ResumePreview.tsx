import { useEffect, useState } from 'react';
import { Button, Drawer } from 'antd';
import { api, type ApiError, type Task } from './api';
import { errorText } from './i18n';

export function ResumePreview({ taskId, lang, onClose }: { taskId: string; lang: 'en' | 'zh'; onClose: () => void }) {
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const zh = lang === 'zh';
  useEffect(() => {
    let active = true;
    setTask(null); setError('');
    api<Task>(`/tasks/${taskId}`)
      .then(value => { if (active) setTask(value); })
      .catch((e: ApiError) => { if (active) setError(e.code || 'REQUEST_FAILED'); });
    return () => { active = false; };
  }, [taskId, attempt]);
  const material = task?.resume?.material;
  return (
    <Drawer open placement="right" title={zh ? '简历预览' : 'Résumé preview'} onClose={onClose}
      styles={{ wrapper: { width: 'min(560px, 96vw)' } }}>
      {error ? <div role="alert">
        <p>{errorText(error, lang)}</p>
        <Button onClick={() => setAttempt(n => n + 1)}>{zh ? '重试' : 'Retry'}</Button>
      </div> : !task ? <p role="status">{zh ? '加载中…' : 'Loading…'}</p> : !material ?
        <p>{zh ? '未提供简历' : 'No resume'}</p> : <>
          <h3 style={{ overflowWrap: 'anywhere' }}>{material.name}</h3>
          <p>{zh ? '来源：本项目关联的简历' : 'Source: this project’s linked résumé'}</p>
          <p style={{ overflowWrap: 'anywhere' }}>{zh ? '材料 ID：' : 'Material ID: '}{material.id}</p>
          {material.errorCode && <p role="alert">{errorText(material.errorCode, lang)}</p>}
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'inherit' }}>
            {material.text || (zh ? '暂无可预览的文本。' : 'No preview text available.')}
          </pre>
        </>}
    </Drawer>
  );
}
