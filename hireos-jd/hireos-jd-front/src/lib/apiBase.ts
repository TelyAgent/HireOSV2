// Resolves to Vite's `base` config (e.g. "/jd/") -- every hand-written `fetch`/WebSocket
// call to this app's own backend must go through this instead of a hardcoded literal
// prefix, so requests keep working whether the app is opened directly on its own port
// or through the unified local gateway (see PORTS.md "本地统一网关").
export const API_BASE_URL = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL) || "/";
