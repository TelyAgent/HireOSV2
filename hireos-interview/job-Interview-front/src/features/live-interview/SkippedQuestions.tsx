import { useSkippedQuestions } from './useSkippedQuestions';

export function SkippedQuestions({ roundId, zh }: { roundId: string; zh: boolean }) {
  const { rows, error, loading, reload } = useSkippedQuestions(roundId);
  return <section style={{ padding: '12px 0' }} aria-label={zh ? '未问题目' : 'Questions not asked'}>
    <h3 style={{ fontSize: 14 }}>{zh ? '未问题目' : 'Questions not asked'}</h3>
    {loading ? <p>{zh ? '加载中…' : 'Loading…'}</p> : error ? <p role="alert">{zh ? '题目记录读取失败' : error} <button onClick={reload}>{zh ? '重试' : 'Retry'}</button></p> : !rows.length ? <p>{zh ? '没有跳题记录' : 'No skipped-question records'}</p> : rows.map(row => <div key={row.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0', overflowWrap: 'anywhere' }}>
      <strong>{row.snapshot.card.requirement}</strong> · {zh ? '未问' : 'Not asked'}
      <p>{row.snapshot.situationPrompt}</p>
      <small>{row.actorId} · {new Date(row.skippedAt).toLocaleString(zh ? 'zh-CN' : 'en-US')} · {row.questionId}</small>
    </div>)}
  </section>;
}
