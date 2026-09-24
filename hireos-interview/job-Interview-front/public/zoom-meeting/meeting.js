/* The SDK requires React 18; keep its runtime isolated from the React 19 host. */
(() => {
  const origin = location.origin;
  const send = (type, detail) => parent.postMessage({ channel: 'hireos-zoom', type, detail }, origin);
  let stage = 'load';
  let secrets = [];
  const failure = (error, type = 'failed') => {
    const code = String(error?.errorCode ?? error?.code ?? 'UNKNOWN').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    let reason = String(error?.reason ?? error?.message ?? 'SDK operation failed');
    for (const secret of secrets) if (secret) reason = reason.split(secret).join('[redacted]');
    reason = reason.replace(/https?:\/\/\S+/g, '[url]').replace(/eyJ[\w.-]+/g, '[token]').slice(0, 240);
    send(type, { stage, code, reason });
  };
  let client;
  let busy = false;
  let disposed = false;
  let resize;
  const script = src => new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('SDK load timeout')), 20000);
    tag.src = src;
    tag.onload = () => { clearTimeout(timeout); resolve(); };
    tag.onerror = () => { clearTimeout(timeout); reject(new Error('SDK load failed')); };
    document.head.appendChild(tag);
  });
  const close = () => {
    disposed = true;
    resize?.disconnect();
    try { Promise.resolve(client?.leaveMeeting()).catch(() => {}); } catch {}
    try { window.ZoomMtgEmbedded?.destroyClient(); } catch {}
  };
  window.addEventListener('pagehide', close);
  window.addEventListener('message', async event => {
    if (event.origin !== origin || event.source !== parent || event.data?.channel !== 'hireos-zoom') return;
    if (event.data.type === 'leave') { close(); return; }
    if (event.data.type !== 'join' || busy || disposed) return;
    busy = true;
    secrets = Object.values(event.data.config || {}).filter(value => typeof value === 'string');
    try {
      const base = 'https://source.zoom.us/6.2.0';
      for (const file of ['react.min.js', 'react-dom.min.js', 'redux.min.js', 'redux-thunk.min.js', 'lodash.min.js']) {
        await script(`${base}/lib/vendor/${file}`);
        if (disposed) return;
      }
      await script('https://source.zoom.us/zoom-meeting-embedded-6.2.0.min.js');
      if (disposed) return;
      client = window.ZoomMtgEmbedded.createClient();
      const connectionChanged = payload => {
        if (disposed) return;
        if (payload.state === 'Connected') send('connected');
        if (payload.state === 'Reconnecting') send('reconnecting');
        if (payload.state === 'Closed') send('closed');
        if (payload.state === 'Fail') failure(payload);
      };
      const root = document.getElementById('meeting');
      // Measure the viewport, not the SDK root whose dimensions the SDK mutates.
      // viewSizes sizes the video canvas; the SDK header and toolbar need space too.
      const videoOptions = () => {
        const height = Math.max(135, document.documentElement.clientHeight - 112);
        // Without SAB, 6.2.0 can use a two-tile 250 x 274 fallback layout.
        const ratio = typeof SharedArrayBuffer === 'function' ? 720 / 411 : 250 / 274;
        const width = Math.max(240, Math.min(document.documentElement.clientWidth, 1440, Math.floor(height * ratio)));
        return {
          isResizable: false,
          popper: { disableDraggable: true, anchorPosition: { top: 0, left: Math.max(0, Math.floor((document.documentElement.clientWidth - width) / 2)) } },
          viewSizes: {
            default: { width, height: Math.min(height, Math.floor(width / ratio)) },
            ribbon: { width: Math.min(316, width), height: Math.min(720, height) },
          },
        };
      };
      stage = 'init';
      await client.init({ zoomAppRoot: root, language: event.data.language, patchJsMedia: true, leaveOnPageUnload: true, customize: { video: { ...videoOptions(), defaultViewType: 'gallery' } } });
      if (disposed) return;
      client.on('connection-change', connectionChanged);
      resize = new ResizeObserver(() => { if (!disposed) client.updateVideoOptions(videoOptions()); });
      resize.observe(document.documentElement);
      const { meetingNumber, password, displayName, signature, zak } = event.data.config;
      stage = 'join';
      await client.join({ meetingNumber, password, userName: displayName, signature, ...(zak ? { zak } : {}) });
    } catch (error) {
      if (!disposed) failure(error);
      close();
    }
  });
  send('ready');
})();
