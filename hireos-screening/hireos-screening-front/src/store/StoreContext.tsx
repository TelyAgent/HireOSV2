import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { translate } from "../data/i18n";
import { getPerson, type PersonId } from "../data/fixtures/people";
import { initialState, PREF_KEYS, PREFS_STORAGE_KEY } from "./initialState";
import { App as AntApp } from "antd";
import type { AppState } from "./types";

/** Kinds of notice `say` can show — rendered with antd `message`. */
export type NoticeType = "default" | "success" | "info" | "error" | "warning";

type Action = { type: "SET"; payload: Partial<AppState> };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

function loadPrefs(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: Partial<AppState> = {};
    for (const key of PREF_KEYS) {
      if (key in parsed) (out as Record<string, unknown>)[key] = parsed[key];
    }
    return out;
  } catch {
    return {};
  }
}

function lazyInit(): AppState {
  return { ...initialState, ...loadPrefs() };
}

interface StoreValue {
  state: AppState;
  set: (partial: Partial<AppState>) => void;
  say: (msg: string, opts?: { type?: NoticeType }) => void;
  toggleLang: () => void;
  setTheme: (theme: AppState["theme"]) => void;
  setAccent: (accent: AppState["accent"]) => void;
  setTextSize: (size: AppState["textSize"]) => void;
  resetAppearance: () => void;
  toggleSidenav: () => void;
  toggleAppearance: () => void;
  toggleRoleSwitcher: () => void;
  setCurrentUser: (id: PersonId) => void;
  t: (source: string, key?: string) => string;
  person: ReturnType<typeof getPerson>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, lazyInit);
  const { message } = AntApp.useApp();

  const set = useCallback((payload: Partial<AppState>) => dispatch({ type: "SET", payload }), []);

  const say = useCallback<StoreValue["say"]>(
    (msg, opts) => {
      const type = opts?.type ?? "default";
      if (type === "default") message.open({ type: "info", content: msg });
      else message[type](msg);
    },
    [message],
  );

  const toggleLang = useCallback(() => set({ lang: state.lang === "en" ? "zh" : "en" }), [set, state.lang]);
  const setTheme = useCallback((theme: AppState["theme"]) => set({ theme }), [set]);
  const setAccent = useCallback((accent: AppState["accent"]) => set({ accent }), [set]);
  const setTextSize = useCallback((textSize: AppState["textSize"]) => set({ textSize }), [set]);
  const resetAppearance = useCallback(() => {
    set({ theme: "light", accent: "teal", textSize: "medium" });
    say(translate(state.lang, "Appearance reset to defaults"));
  }, [set, say, state.lang]);
  const toggleSidenav = useCallback(() => set({ sidenavCollapsed: !state.sidenavCollapsed }), [set, state.sidenavCollapsed]);
  const toggleAppearance = useCallback(() => set({ showAppearance: !state.showAppearance }), [set, state.showAppearance]);
  const toggleRoleSwitcher = useCallback(() => set({ showRoleSwitcher: !state.showRoleSwitcher }), [set, state.showRoleSwitcher]);
  const setCurrentUser = useCallback(
    (id: PersonId) => {
      set({ currentUser: id, showRoleSwitcher: false });
      const p = getPerson(id);
      say(`${translate(state.lang, "Switched to")} ${p?.name} (${translate(state.lang, "Demo role")})`);
    },
    [set, say, state.lang],
  );

  const t = useCallback((source: string, key?: string) => translate(state.lang, source, key), [state.lang]);
  const person = getPerson(state.currentUser);

  // Track OS color-scheme so theme:"system" can reflect it.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    set({ systemDark: mq.matches });
    const onChange = (e: MediaQueryListEvent) => set({ systemDark: e.matches });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist only UI preferences, not domain data (there is none in this store).
  useEffect(() => {
    try {
      const prefs: Record<string, unknown> = {};
      for (const key of PREF_KEYS) prefs[key] = state[key];
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage unavailable (private browsing, etc.) — prefs just won't persist.
    }
    // Deliberately narrow deps: only re-run when a persisted pref actually
    // changes, not on every unrelated state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lang, state.theme, state.accent, state.textSize, state.sidenavCollapsed]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      set,
      say,
      toggleLang,
      setTheme,
      setAccent,
      setTextSize,
      resetAppearance,
      toggleSidenav,
      toggleAppearance,
      toggleRoleSwitcher,
      setCurrentUser,
      t,
      person,
    }),
    [
      state,
      set,
      say,
      toggleLang,
      setTheme,
      setAccent,
      setTextSize,
      resetAppearance,
      toggleSidenav,
      toggleAppearance,
      toggleRoleSwitcher,
      setCurrentUser,
      t,
      person,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within a StoreProvider");
  return ctx;
}
