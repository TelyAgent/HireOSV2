// Resolves to Vite's `base` config (e.g. "/written/") -- once this app makes real
// fetch calls to its own backend they must go through this instead of a hardcoded
// "/api" literal, so requests keep working whether the app is opened directly on its
// own port or through the unified local gateway (see PORTS.md "本地统一网关").
export const API_BASE_URL = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL) || "/";
