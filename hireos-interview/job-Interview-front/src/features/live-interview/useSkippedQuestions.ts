import { useEffect, useState } from 'react';
import { api } from '../project-intake/api';

export type QuestionSkip = { id: string; roundId: string; questionId: string; actorId: string; skippedAt: string; snapshot: { card: { requirement: string }; situationPrompt: string } };
export function useSkippedQuestions(roundId: string | null) {
  const [rows, setRows] = useState<QuestionSkip[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setRows([]); setError(''); setLoading(!!roundId);
    if (roundId) void api<QuestionSkip[]>(`/rounds/${roundId}/skipped-questions`)
      .then(value => { if (active) setRows(value); })
      .catch(() => { if (active) setError('Could not load question records'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roundId, retry]);
  return { rows: rows.filter(r => r.roundId === roundId), loading, error, reload: () => setRetry(n => n + 1),
    record: (row: QuestionSkip) => setRows(rows => [...rows.filter(r => r.questionId !== row.questionId), row]) };
}
