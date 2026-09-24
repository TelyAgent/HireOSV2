import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { initialState } from "./initialState";
import type { AppState, RolePerson, Screen } from "./types";
import { ROLES } from "../data/roles";
import { COMPS, EVIDENCE, R1_SCORES } from "../data/comps";
import { LANG, ZH_TEXT_MAP, STATUS_MAP_EN_ZH } from "../data/i18n";

// ---------------------------------------------------------------------------
// Routing: screen <-> URL path mapping
// ---------------------------------------------------------------------------
const PROJECT_SCREENS: Screen[] = [
  "overview",
  "rubric",
  "plan",
  "schedule",
  "brief",
  "live",
  "review",
  "debrief",
  "decision",
  "package",
];

export function screenToPath(screen: Screen, taskId: string | null): string {
  if (screen === "home") return "/";
  if (screen === "files") return "/files";
  // Project-flow screens are meaningless without a real task to show; fall back home
  // rather than producing a broken /project/undefined/... URL.
  if (!taskId) return "/";
  return `/project/${taskId}/${screen}`;
}

export function pathToRoute(pathname: string): { screen: Screen; taskId: string | null } {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { screen: "home", taskId: null };
  if (path === "/files") return { screen: "files", taskId: null };
  const seg = path.split("/").filter(Boolean);
  if (seg[0] === "project" && seg[1] && seg[2] && PROJECT_SCREENS.includes(seg[2] as Screen)) {
    return { screen: seg[2] as Screen, taskId: seg[1] };
  }
  return { screen: "home", taskId: null };
}

type Action =
  | { type: "SET"; payload: Partial<AppState> }
  | { type: "TOGGLE_LANG" }
  | { type: "TOGGLE_APPEARANCE" }
  | { type: "CYCLE_ROLE" }
  | { type: "SET_THEME"; payload: AppState["theme"] }
  | { type: "SET_ACCENT"; payload: AppState["accent"] }
  | { type: "SET_TEXT_SIZE"; payload: AppState["textSize"] }
  | { type: "TOAST"; payload: string }
  | { type: "GO"; payload: AppState["screen"] }
  | { type: "OPEN_TASK"; payload: { taskId: string; screen: AppState["screen"] } }
  | { type: "RESET_PREFS" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET":
      return { ...state, ...action.payload };
    case "TOGGLE_LANG":
      return { ...state, lang: state.lang === "en" ? "zh" : "en" };
    case "TOGGLE_APPEARANCE":
      return { ...state, showAppearance: !state.showAppearance };
    case "CYCLE_ROLE": {
      const next = (state.roleIdx + 1) % ROLES.length;
      const r = ROLES[next];
      return {
        ...state,
        roleIdx: next,
        toast: `Switched to ${r.name} (${r.title}).`,
      };
    }
    case "SET_THEME":
      return { ...state, theme: action.payload };
    case "SET_ACCENT":
      return { ...state, accent: action.payload };
    case "SET_TEXT_SIZE":
      return { ...state, textSize: action.payload };
    case "TOAST":
      return { ...state, toast: action.payload };
    case "GO": {
      // "home"/"files" are task-agnostic; leaving the project flow clears the task
      // so a stale id doesn't leak into the next screen change.
      const clearsTask = action.payload === "home" || action.payload === "files";
      return {
        ...state,
        screen: action.payload,
        currentTaskId: clearsTask ? null : state.currentTaskId,
        drawer: null,
        showAppearance: false,
      };
    }
    case "OPEN_TASK":
      return {
        ...state,
        screen: action.payload.screen,
        currentTaskId: action.payload.taskId,
        drawer: null,
        showAppearance: false,
      };
    case "RESET_PREFS":
      return {
        ...state,
        theme: "light",
        accent: "teal",
        textSize: "medium",
        moreOpen: false,
        overviewStatsOpen: true,
        toast:
          state.lang === "zh"
            ? "外观已重置为浅色、青绿色和中等字号。"
            : "Appearance reset to Light, Teal, Medium.",
      };
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  set: (p: Partial<AppState>) => void;
  say: (msg: string) => void;
  go: (s: AppState["screen"]) => void;
  openTask: (taskId: string, s?: AppState["screen"]) => void;
  cycleRole: () => void;
  toggleLang: () => void;
  toggleAppearance: () => void;
  setTheme: (t: AppState["theme"]) => void;
  setAccent: (a: AppState["accent"]) => void;
  setTextSize: (s: AppState["textSize"]) => void;
  resetPrefs: () => void;
  role: RolePerson;
  t: (typeof LANG)["en"];
  comps: typeof COMPS;
  evidence: typeof EVIDENCE;
  r1Scores: typeof R1_SCORES;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (initial) => {
    const route = pathToRoute(window.location.pathname);
    return { ...initial, screen: route.screen, currentTaskId: route.taskId };
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist prefs to localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hireos_prefs");
      if (raw) {
        const p = JSON.parse(raw);
        dispatch({
          type: "SET",
          payload: {
            theme: p.theme || "light",
            accent: p.accent || "teal",
            textSize: p.textSize || "medium",
            moreOpen: !!p.moreOpen,
            overviewStatsOpen:
              p.overviewStatsOpen !== false,
            lang: p.lang || "en",
          },
        });
      }
    } catch {}
  }, []);

  // Save prefs on change
  useEffect(() => {
    try {
      localStorage.setItem(
        "hireos_prefs",
        JSON.stringify({
          theme: state.theme,
          accent: state.accent,
          textSize: state.textSize,
          moreOpen: state.moreOpen,
          overviewStatsOpen: state.overviewStatsOpen,
          lang: state.lang,
        }),
      );
    } catch {}
  }, [
    state.theme,
    state.accent,
    state.textSize,
    state.moreOpen,
    state.overviewStatsOpen,
    state.lang,
  ]);

  // System dark mode tracking
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      dispatch({ type: "SET", payload: { systemDark: mq.matches } });
      const handler = (e: MediaQueryListEvent) =>
        dispatch({ type: "SET", payload: { systemDark: e.matches } });
      mq.addEventListener
        ? mq.addEventListener("change", handler)
        : mq.addListener(handler);
      return () => {
        mq.removeEventListener
          ? mq.removeEventListener("change", handler)
          : mq.removeListener(handler);
      };
    } catch {}
  }, []);

  const say = useCallback((msg: string) => {
    dispatch({ type: "TOAST", payload: msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      dispatch({ type: "TOAST", payload: "" });
    }, 4200);
  }, []);

  const value: StoreValue = useMemo(() => {
    const role = ROLES[state.roleIdx];
    const t = LANG[state.lang];
    return {
      state,
      set: (p) => dispatch({ type: "SET", payload: p }),
      say,
      go: (s) => dispatch({ type: "GO", payload: s }),
      openTask: (taskId, s = "overview") => dispatch({ type: "OPEN_TASK", payload: { taskId, screen: s } }),
      cycleRole: () => dispatch({ type: "CYCLE_ROLE" }),
      toggleLang: () => dispatch({ type: "TOGGLE_LANG" }),
      toggleAppearance: () => dispatch({ type: "TOGGLE_APPEARANCE" }),
      setTheme: (theme) => dispatch({ type: "SET_THEME", payload: theme }),
      setAccent: (accent) => dispatch({ type: "SET_ACCENT", payload: accent }),
      setTextSize: (textSize) =>
        dispatch({ type: "SET_TEXT_SIZE", payload: textSize }),
      resetPrefs: () => dispatch({ type: "RESET_PREFS" }),
      role,
      t,
      comps: COMPS,
      evidence: EVIDENCE,
      r1Scores: R1_SCORES,
    };
  }, [state, say]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// RouteSync: keeps the URL in sync with `state.screen` (and vice versa).
// Must be mounted inside <BrowserRouter>. It enables browser back/forward,
// refresh persistence, and shareable deep links without changing any of the
// existing `go(...)` / `set({ screen: ... })` call sites.
// ---------------------------------------------------------------------------
export function RouteSync({ children }: { children?: ReactNode }) {
  const { state, set } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Track the previous screen/task so we only push a URL when either actually
  // *changed* (not on initial mount), and so deep-link/refresh doesn't get
  // immediately overwritten by the initial "home" state.
  const prevRoute = useRef<{ screen: Screen; taskId: string | null }>({ screen: state.screen, taskId: state.currentTaskId });

  // 1) state.screen/currentTaskId -> URL (only when either actually changed)
  useEffect(() => {
    if (prevRoute.current.screen === state.screen && prevRoute.current.taskId === state.currentTaskId) return;
    prevRoute.current = { screen: state.screen, taskId: state.currentTaskId };
    const target = screenToPath(state.screen, state.currentTaskId);
    if (location.pathname !== target) {
      navigate(target, { replace: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen, state.currentTaskId]);

  // 2) URL -> state.screen/currentTaskId (browser back/forward, deep link, refresh)
  useEffect(() => {
    const route = pathToRoute(location.pathname);
    if (route.screen !== state.screen || route.taskId !== state.currentTaskId) {
      prevRoute.current = route;
      set({ screen: route.screen, currentTaskId: route.taskId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return <>{children}</>;
}

// Helpers
export function zhText(s: string, lang: "en" | "zh"): string {
  if (lang !== "zh") return s;
  if (typeof s !== "string") return s;
  const direct = ZH_TEXT_MAP[s] ?? STATUS_MAP_EN_ZH[s] ?? s;
  return direct;
}
