import { initials } from "./lib/initials";
export type Role = "admin" | "hr" | "interviewer";

export type Me = {
  user: { id: string; email: string; displayName: string; avatarColor: string | null; locale: string };
  workspace: { id: string; name: string };
  roles: Role[];
};

export type AuthConfig = { loginRequired: boolean; devLogin: boolean };
export type DevAccount = { email: string; displayName: string; avatarColor: string | null; roles: Role[] };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: Record<string, unknown>,
  ) {
    super(code);
  }
}

/** `/account/` locally, `/hireos/account/` on the server. */
export const BASE_URL = import.meta.env.BASE_URL;
/** Path prefix shared by every subsystem: `/` locally, `/hireos/` on the server. */
export const ROOT_URL = BASE_URL.replace(/account\/$/, "");
export const DEFAULT_LANDING = `${ROOT_URL}jd/`;
/** Workspace member management lives on the JD settings page. */
export const MEMBERS_URL = `${ROOT_URL}jd/settings/members`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new ApiError(response.status, typeof body.code === "string" ? body.code : `HTTP_${response.status}`, body);
  return body as T;
}

const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

export const api = {
  config: () => request<AuthConfig>("/auth/config"),
  me: () => request<Me>("/auth/me"),
  requestCode: (email: string, locale: string) =>
    post<{ sent: true; resendAfterSeconds: number; expiresInSeconds: number }>("/auth/code", { email, locale }),
  verify: (email: string, code: string, returnTo: string | null) =>
    post<Me & { returnTo: string | null }>("/auth/verify", { email, code, returnTo: returnTo ?? undefined }),
  devAccounts: () => request<DevAccount[]>("/auth/dev-accounts"),
  devLogin: (email: string, returnTo: string | null) => post<Me & { returnTo: string | null }>("/auth/dev-login", { email, returnTo: returnTo ?? undefined }),
};

export { initials };
