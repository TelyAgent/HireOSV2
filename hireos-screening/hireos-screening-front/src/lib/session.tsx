import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Dropdown } from "antd";
import { initials } from "./initials";

/*
 * Shared HireOS sign-in for the front ends. The same file lives in every front end (interview,
 * screening, jd, written) — keep the copies identical apart from SECTION.
 *
 * Signed-in state comes from the identity service (`<root>/account/api/auth/me`, same origin, via
 * the HttpOnly `hireos_sid` cookie). When the identity service says sign-in is required, signed-out
 * visitors and any API 401 go to `<root>/account/login?return_to=…`; otherwise (local dev, or before
 * sign-in is switched on) the app keeps running with its demo personas exactly as before.
 */
const SECTION = "screening";

const BASE_URL = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL || "/";
/** `/` locally, `/hireos/` on the server — the prefix every subsystem shares. */
const ROOT_URL = BASE_URL.endsWith(`${SECTION}/`) ? BASE_URL.slice(0, -`${SECTION}/`.length) : "/";
export const ACCOUNT_URL = `${ROOT_URL}account/`;

/** `locale`: the interface language the account chose, or null while it has not chosen one (#233). */
export type SessionUser = { id: string; email: string; displayName: string; avatarColor: string | null; roles: string[]; locale: "zh" | "en" | null };

let loginRequired = false;

export function redirectToSignIn() {
  const here = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`${ACCOUNT_URL}login?return_to=${encodeURIComponent(here)}`);
}

/** Drop-in `fetch` for this subsystem's API: once sign-in is required, a 401 sends the user to sign in again. */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401 && loginRequired) redirectToSignIn();
  return response;
}

export async function signOut() {
  try {
    await fetch(`${ACCOUNT_URL}api/auth/logout`, { method: "POST" });
  } finally {
    window.location.assign(`${ACCOUNT_URL}login`);
  }
}

async function loadSession(): Promise<SessionUser | null> {
  const [me, config] = await Promise.all([
    fetch(`${ACCOUNT_URL}api/auth/me`).catch(() => null),
    fetch(`${ACCOUNT_URL}api/auth/config`)
      .then((r) => (r.ok ? (r.json() as Promise<{ loginRequired?: boolean }>) : {}))
      .catch(() => ({})),
  ]);
  loginRequired = Boolean((config as { loginRequired?: boolean }).loginRequired);
  if (!me?.ok) return null;
  const body = (await me.json()) as { user: Omit<SessionUser, "roles" | "locale"> & { locale?: string; localeChosen?: boolean }; roles: string[] };
  const { locale, localeChosen, ...user } = body.user;
  return { ...user, roles: body.roles, locale: localeChosen && (locale === "zh" || locale === "en") ? locale : null };
}

const SessionContext = createContext<SessionUser | null>(null);

/** Resolves the session before rendering; sends signed-out visitors to sign-in when it is required. */
export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ ready: boolean; user: SessionUser | null }>({ ready: false, user: null });
  useEffect(() => {
    let active = true;
    void loadSession().then((user) => {
      if (!active) return;
      if (!user && loginRequired) redirectToSignIn();
      else setState({ ready: true, user });
    });
    return () => {
      active = false;
    };
  }, []);
  if (!state.ready) return null;
  return <SessionContext.Provider value={state.user}>{children}</SessionContext.Provider>;
}

/** The signed-in user, or null in demo mode (sign-in not required and nobody signed in). */
export function useSessionUser() {
  return useContext(SessionContext);
}

/**
 * One interface language for the account across every module, the next sign-in and other devices (#233). Signed
 * in, the account's language wins over what this browser remembered; switching here saves it to the account.
 * An account without one takes this module's. Only two languages exist, so `switchLang` is a toggle.
 */
export function useAccountLocale(lang: "zh" | "en", switchLang: () => void) {
  const user = useSessionUser();
  const saved = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    if (saved.current === undefined) {
      saved.current = user.locale;
      if (user.locale && user.locale !== lang) {
        switchLang();
        return;
      }
    }
    if (lang === saved.current) return;
    saved.current = lang;
    void fetch(`${ACCOUNT_URL}api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: lang }),
    }).catch(() => undefined);
  }, [user, lang, switchLang]);
}


/** Top-bar pill for the signed-in user: who is signed in, and sign out. */
export function UserMenu({ user, labels }: { user: SessionUser; labels: { signOut: string } }) {
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        items: [
          { key: "email", label: user.email, disabled: true },
          { type: "divider" },
          { key: "signout", label: labels.signOut, danger: true, onClick: () => void signOut() },
        ],
      }}
    >
      <button
        type="button"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 12px 4px 4px",
          border: "1px solid var(--border, #dde3ea)",
          borderRadius: 999,
          background: "var(--surface, #fff)",
          color: "inherit",
          font: "inherit",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: user.avatarColor || "#64748b",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {initials(user.displayName)}
        </span>
        {user.displayName}
      </button>
    </Dropdown>
  );
}
