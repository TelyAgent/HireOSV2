import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/StoreContext';
import { ZoomHostPanel } from '../../features/live-interview/ZoomHostPanel';
import { liveCopy } from '../../features/live-interview/i18n';
import { LiveQuestionPanel } from '../../features/live-interview/LiveQuestionPanel';
import { MeetingRecordPanel } from '../../features/live-interview/MeetingRecordPanel';
import { api } from '../../features/project-intake/api';
import { useTask } from '../../features/project-intake/useTask';

export function LivePage() {
  const { state, set, t } = useStore();
  const zh = state.lang === 'zh';
  const copy = liveCopy[state.lang];
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { task } = useTask(state.currentTaskId);
  const round = state.roundView === 'r2' ? 2 : 1;
  const currentRound = task?.rounds.find((r) => r.sequence === round);
  const roundId = currentRound?.id ?? null;
  const isCompleted = currentRound?.status === 'completed';
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const complete = async () => {
    if (!roundId) return;
    if ((active || dirty) && !window.confirm(copy.confirmLeave + '\n' + copy.draft)) return;
    setCompleting(true); setCompleteError('');
    try {
      await api(`/rounds/${roundId}/complete`, { method: 'POST' });
      set({ screen: 'review' });
    } catch (e) { setCompleteError(e instanceof Error ? e.message : 'REQUEST_FAILED'); }
    finally { setCompleting(false); }
  };
  // Captured once on arrival (e.g. from Schedule's "Join link") and cleared right away —
  // a normal visit to Live Interview via the nav tabs has none, and re-visiting later
  // must not keep re-triggering an auto-join from a stale value.
  const [joinRound] = useState(state.liveJoinRound);
  useEffect(() => { if (state.liveJoinRound) set({ liveJoinRound: null }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active && !dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (target && (target.closest('[role="navigation"]') || target.tagName === 'A') && !root.current?.contains(target) && !window.confirm(copy.confirmLeave + '\n' + copy.draft)) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigation, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigation, true); };
  }, [active, dirty, copy]);

  return <div ref={root} style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 44, padding: '0 14px', flexWrap: 'wrap' }}>
      <button onClick={() => {
        if ((active || dirty) && !window.confirm(copy.confirmLeave + '\n' + copy.draft)) return;
        set({ screen: 'plan' });
      }} style={{ border: 0, background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', padding: 0 }}>{t.exitToPlan}</button>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{copy.title}</div>
        <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--ink-3)' }}>{copy.subtitle}</div>
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{copy.recording}</span>
    </div>
    <div className="live-shell">
      <div className="live-main">
        {isCompleted
          ? <div className="zoom-panel"><div className="zoom-stage"><div className="zoom-placeholder"><strong>Zoom</strong><p>{zh ? '本轮面试已完成，会议已结束，无法再加入。' : 'This round is complete; the meeting has ended and can no longer be joined.'}</p></div></div></div>
          : <ZoomHostPanel lang={state.lang} onActive={setActive} round={joinRound} autoJoin={!!joinRound} />}
        <LiveQuestionPanel />
      </div>
      <MeetingRecordPanel lang={state.lang} dirty={dirty} onDirty={setDirty} taskId={state.currentTaskId} round={round} roundId={roundId} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
      {completeError && <span style={{ fontSize: 11.5, color: 'var(--bad)' }}>{completeError}</span>}
      <button disabled={!roundId || completing} onClick={() => void complete()} style={{ minHeight: 36, padding: '0 15px', border: '1px solid var(--brand)', borderRadius: 9, color: 'var(--brand-ink)', background: 'var(--brand)', cursor: !roundId || completing ? 'not-allowed' : 'pointer', opacity: !roundId || completing ? 0.6 : 1 }}>{completing ? (zh ? '提交中…' : 'Completing…') : copy.complete}</button>
    </div>
  </div>;
}
