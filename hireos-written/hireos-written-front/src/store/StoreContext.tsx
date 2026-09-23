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
import { getUser } from "../data/users";
import { initialState, PREF_KEYS, PREFS_STORAGE_KEY } from "./initialState";
import type { AppState, ToastItem, UserId } from "./types";

type Action =
  | { type: "SET"; payload: Partial<AppState> }
  | { type: "PUSH_TOAST"; toast: ToastItem }
  | { type: "DISMISS_TOAST"; id: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.payload };
    case "PUSH_TOAST":
      return { ...state, toasts: [...state.toasts, action.toast] };
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
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
  say: (msg: string, opts?: { type?: ToastItem["type"] }) => void;
  dismissToast: (id: string) => void;
  toggleLang: () => void;
  setTheme: (theme: AppState["theme"]) => void;
  setAccent: (accent: AppState["accent"]) => void;
  setTextSize: (size: AppState["textSize"]) => void;
  resetAppearance: () => void;
  toggleSidebar: () => void;
  toggleAppearance: () => void;
  toggleRoleSwitcher: () => void;
  setCurrentUser: (id: UserId) => void;
  advanceClock: (hours: number) => void;
  t: (source: string) => string;
  user: ReturnType<typeof getUser>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, lazyInit);

  const set = useCallback((payload: Partial<AppState>) => dispatch({ type: "SET", payload }), []);

  const dismissToast = useCallback((id: string) => dispatch({ type: "DISMISS_TOAST", id }), []);

  const say = useCallback<StoreValue["say"]>(
    (msg, opts) => {
      const id = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
      dispatch({ type: "PUSH_TOAST", toast: { id, msg, type: opts?.type ?? "default" } });
      setTimeout(() => dismissToast(id), 3400);
    },
    [dismissToast],
  );

  const toggleLang = useCallback(() => set({ lang: state.lang === "en" ? "zh" : "en" }), [set, state.lang]);
  const setTheme = useCallback((theme: AppState["theme"]) => set({ theme }), [set]);
  const setAccent = useCallback((accent: AppState["accent"]) => set({ accent }), [set]);
  const setTextSize = useCallback((textSize: AppState["textSize"]) => set({ textSize }), [set]);
  const resetAppearance = useCallback(() => {
    set({ theme: "light", accent: "teal", textSize: "medium" });
    say(translate(state.lang, "Reset to defaults"));
  }, [set, say, state.lang]);
  const toggleSidebar = useCallback(() => set({ sidebarCollapsed: !state.sidebarCollapsed }), [set, state.sidebarCollapsed]);
  const toggleAppearance = useCallback(() => set({ showAppearance: !state.showAppearance }), [set, state.showAppearance]);
  const toggleRoleSwitcher = useCallback(() => set({ showRoleSwitcher: !state.showRoleSwitcher }), [set, state.showRoleSwitcher]);
  const setCurrentUser = useCallback(
    (id: UserId) => {
      set({ currentUser: id, showRoleSwitcher: false });
      const u = getUser(id);
      say(`${translate(state.lang, "Switched to")} ${u.name} (${translate(state.lang, "Demo role")})`);
    },
    [set, say, state.lang],
  );
  const advanceClock = useCallback(
    (hours: number) => {
      set({ clockOffsetMin: state.clockOffsetMin + hours * 60 });
      say(`${translate(state.lang, "Demo clock advanced")} ${hours}h.`);
    },
    [set, say, state.clockOffsetMin, state.lang],
  );

  const t = useCallback((source: string) => translate(state.lang, source), [state.lang]);
  const user = getUser(state.currentUser);

  // Track OS color-scheme so theme:"system" can reflect it.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    set({ systemDark: mq.matches });
    const onChange = (e: MediaQueryListEvent) => set({ systemDark: e.matches });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect theme/accent/text-size onto <html> exactly like the prototype's applyThemeAttrs().
  useEffect(() => {
    const html = document.documentElement;
    const mode = state.theme === "system" ? (state.systemDark ? "dark" : "light") : state.theme;
    if (mode === "light") html.removeAttribute("data-app-theme");
    else html.setAttribute("data-app-theme", mode);
    if (state.accent === "blue") html.removeAttribute("data-accent");
    else html.setAttribute("data-accent", state.accent);
    html.setAttribute("data-text-size", state.textSize);
  }, [state.theme, state.systemDark, state.accent, state.textSize]);

  // Persist only UI preferences, not domain data (there is none in this store).
  useEffect(() => {
    try {
      const prefs: Record<string, unknown> = {};
      for (const key of PREF_KEYS) prefs[key] = state[key];
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage unavailable (private browsing, etc.) — prefs just won't persist.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lang, state.theme, state.accent, state.textSize, state.sidebarCollapsed, state.shellMode, state.currentUser]);

  const value = useMemo<StoreValue>(
    () => ({
      state, set, say, dismissToast, toggleLang, setTheme, setAccent, setTextSize,
      resetAppearance, toggleSidebar, toggleAppearance, toggleRoleSwitcher, setCurrentUser,
      advanceClock, t, user,
    }),
    [state, set, say, dismissToast, toggleLang, setTheme, setAccent, setTextSize,
      resetAppearance, toggleSidebar, toggleAppearance, toggleRoleSwitcher, setCurrentUser,
      advanceClock, t, user],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within a StoreProvider");
  return ctx;
}
