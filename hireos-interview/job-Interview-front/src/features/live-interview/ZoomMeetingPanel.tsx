import { useEffect, useRef, useState } from 'react';
import { liveCopy } from './i18n';
import { API_BASE_URL } from '../../utils/apiBase';
import './zoom-meeting.css';

type Status = 'idle' | 'loading' | 'joining' | 'joined' | 'reconnecting' | 'left' | 'error';
type JoinConfig = { meetingNumber: string; password: string; displayName: string; signature: string; expiresAt: number; zak?: string; joinUrl?: string };

export function ZoomMeetingPanel({ lang, onActive, host = false, onInvitation, roundId, topic, autoJoin = false }: { lang: 'zh' | 'en'; onActive: (active: boolean) => void; host?: boolean; onInvitation?: (url: string) => void; roundId?: string; topic?: string; autoJoin?: boolean }) {
  const t = liveCopy[lang];
  const frame = useRef<HTMLIFrameElement>(null);
  const request = useRef<AbortController | null>(null);
  const config = useRef<JoinConfig | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef<number | null>(null);
  const rtmsStartedForRound = useRef<string | null>(null);
  const active = status === 'loading' || status === 'joining' || status === 'joined' || status === 'reconnecting';

  useEffect(() => { onActive(active); return () => onActive(false); }, [active, onActive]);
  useEffect(() => () => { request.current?.abort(); request.current = null; config.current = null; }, []);
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      if (config.current) { config.current = null; setError('failed'); setStatus('error'); setMounted(false); }
    }, 20000);
    return () => clearTimeout(timer);
  }, [mounted, attempt]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (started.current != null) setElapsed(Math.floor((Date.now() - started.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== 'hireos-zoom') return;
      if (event.data.type === 'ready' && config.current) {
        frame.current?.contentWindow?.postMessage({ channel: 'hireos-zoom', type: 'join', config: config.current, language: lang === 'zh' ? 'zh-CN' : 'en-US' }, window.location.origin);
        config.current = null;
      }
      if (event.data.type === 'connected') {
        started.current ??= Date.now();
        setStatus('joined');
        if (host && roundId && rtmsStartedForRound.current !== roundId) {
          rtmsStartedForRound.current = roundId;
          void fetch(`${API_BASE_URL}api/meetings/host/rtms/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-hireos-zoom': '1' },
            body: JSON.stringify({ roundId }),
          }).then(async response => {
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.code || 'RTMS_START_FAILED');
          }).catch(error => {
            rtmsStartedForRound.current = null;
            setDiagnostic(error instanceof Error ? error.message : 'RTMS_START_FAILED');
          });
        }
      }
      if (event.data.type === 'reconnecting') setStatus('reconnecting');
      if (event.data.type === 'action-error') {
        const detail = event.data.detail;
        setDiagnostic([detail?.code, detail?.reason].filter(value => typeof value === 'string').join(' · ').slice(0, 320));
        return;
      }
      if (event.data.type === 'closed' || event.data.type === 'failed') {
        const detail = event.data.detail;
        if (event.data.type === 'failed' && detail && ['load', 'init', 'join'].includes(detail.stage)) {
          setDiagnostic([detail.stage, detail.code, detail.reason].filter(value => typeof value === 'string').join(' · ').slice(0, 320));
        }
        setStatus(event.data.type === 'closed' ? 'left' : 'error');
        setError(event.data.type === 'failed' ? 'failed' : '');
        started.current = null;
        setMounted(false);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [lang]);

  const leave = () => {
    request.current?.abort(); request.current = null; config.current = null;
    frame.current?.contentWindow?.postMessage({ channel: 'hireos-zoom', type: 'leave' }, window.location.origin);
    // Removing the isolated browsing context also releases its media tracks.
    setMounted(false); started.current = null; setStatus('left');
  };
  const join = async () => {
    if (request.current || active) return;
    if (!window.isSecureContext || matchMedia('(pointer: coarse)').matches) { setError('unsupported'); setStatus('error'); return; }
    const controller = new AbortController(); request.current = controller;
    setError(''); setDiagnostic(''); setStatus('loading'); setElapsed(0);
    const timeout = setTimeout(() => controller.abort(), host ? 75000 : 15000);
    try {
      const response = await fetch(
        host ? `${API_BASE_URL}api/meetings/host/start` : `${API_BASE_URL}api/meetings/dev/join-config`,
        { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'x-hireos-zoom': '1' }, body: host ? JSON.stringify({ roundId, topic }) : undefined },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.code || 'failed');
      if (controller.signal.aborted) return;
      config.current = body;
      if (body.joinUrl) onInvitation?.(body.joinUrl);
      setAttempt(value => value + 1); setMounted(true); setStatus('joining');
    } catch (e) {
      if (request.current !== controller) return;
      const code = e instanceof Error ? e.message : '';
      if (/^ZOOM_[A-Z_]+$/.test(code)) setDiagnostic(code);
      setError(({ ZOOM_DISABLED: 'disabled', ZOOM_NOT_CONFIGURED: 'configuration', AUTH_REQUIRED: 'auth', ZOOM_RATE_LIMITED: 'rate' } as Record<string, string>)[code] || 'failed');
      setStatus('error');
    } finally { clearTimeout(timeout); if (request.current === controller) request.current = null; }
  };
  // Fires once when arriving with an explicit round to join (Schedule's "Join link").
  // Doesn't need a user gesture — unlike connecting Zoom itself, this is a plain fetch
  // plus an iframe mount, not a window.open the browser could block. Deferred a tick so
  // it lands after React 18 StrictMode's dev-only mount→cleanup→mount cycle settles —
  // firing synchronously on mount, the cycle's own (unrelated) unmount cleanup aborts
  // this request before it ever completes.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (!autoJoin || autoJoinedRef.current) return;
    const timer = setTimeout(() => {
      if (!autoJoinedRef.current) { autoJoinedRef.current = true; void join(); }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin]);

  return <div className="zoom-panel">
    <div className="zoom-status" role="status">
      <span>{t[status]}</span><span>{Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</span>
      <button onClick={active ? leave : join}>{active ? t.leave : status === 'error' ? t.retry : host ? (lang === 'zh' ? '创建 / 加入会议' : 'Create / join meeting') : t.join}</button>
    </div>
    <div className="zoom-stage">
      {mounted && diagnostic && <div role="alert">{diagnostic}</div>}
      {mounted && <iframe key={attempt} ref={frame} src={`${API_BASE_URL}zoom-meeting/index.html`} title="Zoom meeting" allow="camera; microphone; display-capture; fullscreen; autoplay" />}
      {!mounted && <div className="zoom-placeholder"><strong>Zoom</strong><p>{error ? t[error as keyof typeof t] : t.idle}</p>{diagnostic && <p role="alert">{diagnostic}</p>}</div>}
    </div>
  </div>;
}
