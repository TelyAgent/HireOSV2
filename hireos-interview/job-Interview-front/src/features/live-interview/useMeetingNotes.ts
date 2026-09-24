import { useCallback, useEffect, useRef, useState } from 'react';
import { recordApi, type MeetingRecord, type RecordNote } from './record-api';

type SaveState = 'loading' | 'saved' | 'pending' | 'saving' | 'error' | 'conflict';

export function useMeetingNotes(sessionId: string) {
  const [record, setRecord] = useState<MeetingRecord | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [status, setStatus] = useState<SaveState>('loading');
  const [error, setError] = useState('');
  const [remote, setRemote] = useState<RecordNote | null>(null);
  const version = useRef(0);
  const draft = useRef('');
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    setStatus('loading'); setError('');
    recordApi<MeetingRecord>(`/interview-sessions/${sessionId}/record`, { signal: controller.signal })
      .then(value => {
        if (controller.signal.aborted) return;
        setRecord(value); version.current = value.note.version; draft.current = value.note.content;
        setContent(value.note.content); setSavedContent(value.note.content); setStatus('saved');
      })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setStatus('error'); } });
    return () => { mounted.current = false; controller.abort(); };
  }, [sessionId, reload]);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const text = draft.current;
    setStatus('saving'); setError('');
    try {
      const note = await recordApi<RecordNote>(`/interview-sessions/${sessionId}/record/notes/me`, {
        method: 'PUT', body: JSON.stringify({ content: text, version: version.current }),
      });
      if (!mounted.current) return;
      version.current = note.version; setSavedContent(note.content); setRemote(null);
      setStatus(draft.current === note.content ? 'saved' : 'pending');
    } catch (e) {
      if (!mounted.current) return;
      const message = e instanceof Error ? e.message : 'RECORD_REQUEST_FAILED';
      setError(message); setStatus(message === 'NOTE_VERSION_CONFLICT' ? 'conflict' : 'error');
    } finally { inFlight.current = false; }
  }, [sessionId]);

  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [status, content, save]);

  const edit = (text: string) => {
    draft.current = text; setContent(text);
    if (status !== 'saving' && status !== 'conflict' && status !== 'error') setStatus('pending');
  };
  const compare = async () => {
    try {
      const value = await recordApi<MeetingRecord>(`/interview-sessions/${sessionId}/record`);
      if (mounted.current) setRemote(value.note);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'RECORD_REQUEST_FAILED'); }
  };
  const resolve = (keepLocal: boolean) => {
    if (!remote) return;
    version.current = remote.version; setSavedContent(remote.content); setError('');
    if (!keepLocal) { draft.current = remote.content; setContent(remote.content); }
    setRemote(null); setStatus(keepLocal && draft.current !== remote.content ? 'pending' : 'saved');
  };
  return { record, content, status, error, remote, edit, save, compare, resolve,
    dirty: content !== savedContent || status === 'saving', retryLoad: () => setReload(n => n + 1) };
}
