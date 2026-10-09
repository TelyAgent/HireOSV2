import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { translate } from "../data/i18n";
import { getPerson } from "../data/fixtures/people";
import { setFormatLang, uid } from "../lib/format";
import { initialState, PREF_KEYS, PREFS_STORAGE_KEY } from "./initialState";
import { App as AntApp } from "antd";
import type { AppState, Lang } from "./types";
import type { PersonId } from "../data/types";

type Action =
  | { type: "SET"; payload: Partial<AppState> }
  /**
   * Faithful port of the prototype's mutate-then-rerender model: `fn` mutates
   * nested objects in place and we hand back a fresh top-level object so React
   * re-renders. Domain data here is demo fixture data, never shared state.
   */
  | { type: "MUTATE"; fn: (draft: AppState) => void };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.payload };
    case "MUTATE": {
      const next = { ...state };
      action.fn(next);
      return next;
    }
    default:
      return state;
  }
}

function loadPrefs(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: Record<string, unknown> = {};
    for (const key of PREF_KEYS) if (key in parsed) out[key] = parsed[key];
    return out as Partial<AppState>;
  } catch {
    return {};
  }
}

function lazyInit(): AppState {
  const merged = { ...initialState, ...loadPrefs() };
  setFormatLang(merged.lang);
  return merged;
}

export interface OverlayOpts {
  wide?: boolean;
  xwide?: boolean;
  drawerClass?: string;
  overlayClass?: string;
}
export interface OverlayEntry extends OverlayOpts {
  id: string;
  kind: "modal" | "drawer";
  node: ReactNode;
}

/** `say` renders with antd `message`; "default" shows as info. */
export interface SayOpts {
  type?: "default" | "success" | "error" | "info" | "warning";
}

interface StoreValue {
  state: AppState;
  set: (partial: Partial<AppState>) => void;
  mutate: (fn: (draft: AppState) => void) => void;
  say: (msg: string, opts?: SayOpts) => void;

  overlays: OverlayEntry[];
  openModal: (node: ReactNode, opts?: OverlayOpts) => void;
  openDrawer: (node: ReactNode, opts?: OverlayOpts) => void;
  closeModal: () => void;
  closeAllModals: () => void;

  toggleLang: () => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: AppState["theme"]) => void;
  setAccent: (accent: AppState["accent"]) => void;
  setTextSize: (size: AppState["textSize"]) => void;
  resetAppearance: () => void;
  toggleSidenav: () => void;
  setCurrentUser: (id: PersonId) => void;

  t: (source: string, key?: string) => string;
  person: ReturnType<typeof getPerson>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, lazyInit);
  const [overlays, setOverlays] = useState<OverlayEntry[]>([]);
  const { message } = AntApp.useApp();

  const set = useCallback((payload: Partial<AppState>) => dispatch({ type: "SET", payload }), []);
  const mutate = useCallback((fn: (draft: AppState) => void) => dispatch({ type: "MUTATE", fn }), []);

  const say = useCallback<StoreValue["say"]>(
    (msg, opts) => {
      const type = opts?.type ?? "default";
      if (type === "default") message.open({ type: "info", content: msg });
      else message[type](msg);
    },
    [message],
  );

  const pushOverlay = useCallback((kind: OverlayEntry["kind"], node: ReactNode, opts?: OverlayOpts) => {
    setOverlays((prev) => [...prev, { id: uid("ovl"), kind, node, ...opts }]);
  }, []);
  const openModal = useCallback((node: ReactNode, opts?: OverlayOpts) => pushOverlay("modal", node, opts), [pushOverlay]);
  const openDrawer = useCallback((node: ReactNode, opts?: OverlayOpts) => pushOverlay("drawer", node, opts), [pushOverlay]);
  const closeModal = useCallback(() => setOverlays((prev) => prev.slice(0, -1)), []);
  const closeAllModals = useCallback(() => setOverlays([]), []);

  const setLang = useCallback(
    (lang: Lang) => {
      setFormatLang(lang);
      set({ lang });
    },
    [set],
  );
  const toggleLang = useCallback(() => setLang(state.lang === "en" ? "zh" : "en"), [setLang, state.lang]);

  const setTheme = useCallback((theme: AppState["theme"]) => set({ theme }), [set]);
  const setAccent = useCallback((accent: AppState["accent"]) => set({ accent }), [set]);
  const setTextSize = useCallback((textSize: AppState["textSize"]) => set({ textSize }), [set]);
  const resetAppearance = useCallback(() => {
    set({ theme: "light", accent: "teal", textSize: "medium" });
    say(translate(state.lang, "Appearance reset to defaults"));
  }, [set, say, state.lang]);
  const toggleSidenav = useCallback(
    () => set({ sidenavCollapsed: !state.sidenavCollapsed }),
    [set, state.sidenavCollapsed],
  );

  const setCurrentUser = useCallback(
    (id: PersonId) => {
      set({ currentUserId: id });
      closeModal();
      say(translate(state.lang, "Switched to") + " " + (getPerson(id)?.name ?? ""));
    },
    [set, say, closeModal, state.lang],
  );

  const t = useCallback((source: string, key?: string) => translate(state.lang, source, key), [state.lang]);
  const person = getPerson(state.currentUserId);

  // Esc closes the topmost overlay, matching the prototype's escHandler.
  useEffect(() => {
    if (overlays.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [overlays.length, closeModal]);

  // Track OS color-scheme so theme:"system" can reflect it.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    set({ systemDark: mq.matches });
    const onChange = (e: MediaQueryListEvent) => set({ systemDark: e.matches });
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist only UI preferences, never the demo domain data.
  useEffect(() => {
    try {
      const prefs: Record<string, unknown> = {};
      for (const key of PREF_KEYS) prefs[key] = state[key];
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // localStorage unavailable (private browsing, etc.) — prefs just won't persist.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lang, state.theme, state.accent, state.textSize, state.sidenavCollapsed]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      set,
      mutate,
      say,
      overlays,
      openModal,
      openDrawer,
      closeModal,
      closeAllModals,
      toggleLang,
      setLang,
      setTheme,
      setAccent,
      setTextSize,
      resetAppearance,
      toggleSidenav,
      setCurrentUser,
      t,
      person,
    }),
    [
      state,
      set,
      mutate,
      say,
      overlays,
      openModal,
      openDrawer,
      closeModal,
      closeAllModals,
      toggleLang,
      setLang,
      setTheme,
      setAccent,
      setTextSize,
      resetAppearance,
      toggleSidenav,
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
