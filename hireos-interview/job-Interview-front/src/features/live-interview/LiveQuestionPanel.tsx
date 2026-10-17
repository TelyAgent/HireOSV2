import { useState } from 'react';
import { useStore } from '../../store/StoreContext';
import { useProjectTask } from '../project-intake/useTask';
import { useBrief } from '../project-intake/useBrief';
import { Pill } from '../../utils/status';
import { api } from '../project-intake/api';
import { useSkippedQuestions, type QuestionSkip } from './useSkippedQuestions';

const btn = { height: 30, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 9, background: 'transparent', color: 'var(--ink-2)', fontSize: 12.5, cursor: 'pointer' } as const;

/** The Interview Brief's real questions — one STAR set per confirmed capability card — walked
 * through one at a time. Skip records belong to the selected real round. */
export function LiveQuestionPanel({ roundId, completed = false }: { roundId: string | null; completed?: boolean }) {
  const { state, t } = useStore();
  const zh = state.lang === 'zh';
  const { task } = useProjectTask();
  const { state: brief, loading } = useBrief(task?.job.id ?? null);
  const questions = brief?.questions ?? [];
  const [index, setIndex] = useState(0);
  const skipped = useSkippedQuestions(roundId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const card = { marginTop: 12, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--surface)' } as const;
  if (loading || !brief) return <div style={{ ...card, fontSize: 12.5, color: 'var(--ink-3)' }}>{zh ? '加载中…' : 'Loading…'}</div>;
  if (!questions.length) return <div style={{ ...card, fontSize: 12.5, color: 'var(--ink-3)' }}>{zh ? '面试提要还没有生成问题。' : 'The Interview Brief has no questions yet.'}</div>;

  const q = questions[Math.min(index, questions.length - 1)];
  const last = index >= questions.length - 1;
  const stageLabels = zh ? ['背景', '任务', '行动', '结果'] : ['SITUATION', 'TASK', 'ACTION', 'RESULT'];
  const star = [q.situationPrompt, q.taskPrompt, q.actionPrompt, q.resultPrompt];
  const tags = q.card.competencyTags.split(',').map((s) => s.trim()).filter(Boolean);
  const move = (delta: number) => setIndex((i) => Math.max(0, Math.min(questions.length - 1, i + delta)));
  const skip = async () => {
    if (!roundId || saving) return;
    setSaving(true); setSaveError('');
    try { skipped.record(await api<QuestionSkip>(`/rounds/${roundId}/questions/${q.id}/skip`, { method: 'POST' })); move(1); }
    catch { setSaveError(zh ? '跳题保存失败，请重试' : 'Could not save skip. Please retry.'); }
    finally { setSaving(false); }
  };

  return <div style={card}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: '.05em', color: 'var(--ink-3)' }}>
        {t.currentQuestion} · {index + 1} / {questions.length}
      </div>
      {q.card.cardPriority === 'P0' && <Pill label={zh ? '必须项' : 'Must-have'} tone="bad" />}
      {q.mandatory && <Pill label={zh ? '必问' : 'Mandatory'} tone="warn" />}
      {skipped.rows.some(row => row.questionId === q.id) && <Pill label={zh ? '未问' : 'Not asked'} tone="unknown" />}
    </div>
    <div style={{ marginTop: 8, fontSize: 14.5, fontWeight: 600 }}>{q.card.requirement}</div>
    {tags.length > 0 && <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--ink-3)' }}>{t.targetsLabel}{tags.join(zh ? '、' : ', ')}</div>}
    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 12.5, lineHeight: 1.5 }}>
      {star.map((text, i) => [
        <div key={`l${i}`} style={{ fontWeight: 600, color: 'var(--brand)' }}>{stageLabels[i]}</div>,
        <div key={`t${i}`} style={{ color: 'var(--ink)' }}>{text}</div>,
      ])}
    </div>
    {q.card.expectedEvidence && (
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-2)' }}>{zh ? '期望证据：' : 'Expected evidence: '}{q.card.expectedEvidence}</div>
    )}
    <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 9 }}>
      <button disabled={index === 0} onClick={() => move(-1)} style={{ ...btn, cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.5 : 1 }}>
        {zh ? '上一个问题' : 'Previous'}
      </button>
      <button disabled={last} onClick={() => move(1)} style={{ ...btn, border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--ink)', cursor: last ? 'not-allowed' : 'pointer', opacity: last ? 0.5 : 1 }}>
        {t.nextQuestionBtn}
      </button>
      <button disabled={!roundId || completed || saving || skipped.loading || !!skipped.error} onClick={() => void skip()} style={btn}>
        {t.skipBtn}
      </button>
    </div>
    {saveError && <p role="alert">{saveError}</p>}
    {skipped.error && <p role="alert">{zh ? '题目记录读取失败' : skipped.error} <button onClick={skipped.reload}>{zh ? '重试' : 'Retry'}</button></p>}
  </div>;
}
