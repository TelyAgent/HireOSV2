import { useCallback, useEffect, useState } from 'react';
import { ZoomMeetingPanel } from './ZoomMeetingPanel';
import { API_BASE_URL } from '../../utils/apiBase';

type Connection = { connected: boolean; name: string | null; pending: boolean; error: string | null; meeting?: { joinUrl: string } | null };
type Round = { roundId: string; topic: string };
export function ZoomHostPanel({ lang, onActive, round = null, autoJoin = false }: { lang: 'zh' | 'en'; onActive: (active: boolean) => void; round?: Round | null; autoJoin?: boolean }) {
  const zh = lang === 'zh';
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const [invite, setInvite] = useState('');
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);
  const activity = useCallback((value: boolean) => { setActive(value); onActive(value); }, [onActive]);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}api/meetings/host/status`, { signal: controller.signal });
        const body = await response.json(); if (!response.ok) throw new Error(body.code || 'ZOOM_STATUS_FAILED');
        if (!controller.signal.aborted) {
          setConnection(body);
          if (!round?.roundId) setInvite(body.meeting?.joinUrl || '');
          if (body.error) setError(body.error);
        }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'ZOOM_STATUS_FAILED'); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2500);
    };
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [reload, round?.roundId]);

  // The status endpoint's `meeting` field is the account's default meeting. A
  // scheduled round has its own meeting, so never expose the default link from
  // this panel when the user is working inside a specific round.
  useEffect(() => {
    if (!connection?.connected || !round?.roundId) return;
    const controller = new AbortController();
    void fetch(`${API_BASE_URL}api/meetings/host/link`, {
      method: 'POST',
      headers: { 'x-hireos-zoom': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: round.roundId, topic: round.topic }),
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.code || 'ZOOM_LINK_FAILED');
        if (!controller.signal.aborted && body.joinUrl) {
          setInvite(body.joinUrl);
          setCopied(false);
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'ZOOM_LINK_FAILED');
      });
    return () => controller.abort();
  }, [connection?.connected, round?.roundId, round?.topic]);
  const connect = async () => {
    if (busy) return;
    const popup = window.open('about:blank', '_blank');
    if (!popup) { setError('POPUP_BLOCKED'); return; }
    popup.opener = null; setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}api/meetings/host/authorize`, { method: 'POST', headers: { 'x-hireos-zoom': '1' }, signal: AbortSignal.timeout(15000) });
      const body = await response.json(); if (!response.ok) throw new Error(body.code || 'ZOOM_AUTH_FAILED');
      const url = new URL(body.authorizationUrl); if (url.origin !== 'https://zoom.us') throw new Error('ZOOM_AUTH_FAILED');
      popup.location.href = url.href; setReload(value => value + 1);
    } catch (error) { popup.close(); setError(error instanceof Error ? error.message : 'ZOOM_AUTH_FAILED'); }
    finally { setBusy(false); }
  };
  return <div style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, fontSize: 12 }}>
      <span style={{ flex: 1 }}>{connection?.connected ? `${zh ? '主持人' : 'Host'}: ${connection.name}` : connection?.pending ? (zh ? '等待 Zoom 授权' : 'Awaiting Zoom authorization') : (zh ? '未连接 Zoom' : 'Zoom not connected')}</span>
      <button disabled={busy || active} onClick={connect}>{busy ? '…' : connection?.connected ? (zh ? '重新授权' : 'Reconnect') : (zh ? '连接 Zoom' : 'Connect Zoom')}</button>
      {invite && <button onClick={async () => { try { await navigator.clipboard.writeText(invite); setCopied(true); } catch { setError('CLIPBOARD_FAILED'); } }}>{copied ? (zh ? '已复制' : 'Copied') : (zh ? '复制邀请链接' : 'Copy invitation')}</button>}
      {connection?.connected && <button disabled={active || busy} onClick={async () => {
        if (!window.confirm(zh ? '请先在 Zoom 确认旧会议已结束。此操作只清除当前会议关联，不会结束旧会议。继续？' : 'First verify the old meeting has ended in Zoom. This only clears its local link; it does not end the meeting. Continue?')) return;
        setBusy(true);
        try {
          const response = await fetch(`${API_BASE_URL}api/meetings/host/reset-meeting`, { method: 'POST', headers: { 'x-hireos-zoom': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId: round?.roundId }) });
          if (!response.ok) throw new Error('ZOOM_RESET_FAILED');
          setInvite(''); setCopied(false); setError(''); setReload(value => value + 1);
        } catch { setError('ZOOM_RESET_FAILED'); } finally { setBusy(false); }
      }}>{zh ? '准备新会议' : 'Prepare new meeting'}</button>}
    </div>
    {error && <div role="alert" style={{ fontSize: 12, color: 'var(--bad)', paddingBottom: 10 }}>{error}{error === 'ZOOM_PUBLIC_CLIENT_ID_REQUIRED' && (zh ? '：请配置后端 Public Client ID' : ': configure the backend Public Client ID')}</div>}
    {connection?.connected
      ? <ZoomMeetingPanel lang={lang} onActive={activity} host onInvitation={setInvite} roundId={round?.roundId} topic={round?.topic} autoJoin={autoJoin} />
      : <div className="zoom-panel"><div className="zoom-stage"><div className="zoom-placeholder"><strong>Zoom</strong><p>{zh ? '连接账户后，可在此创建会议并加入。' : 'Connect your account to create a meeting and join it here.'}</p></div></div></div>}
  </div>;
}
