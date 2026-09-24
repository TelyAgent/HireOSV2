import type { AppState } from "./types";

export const initialState: AppState = {
  lang: "en",
  theme: "light",
  accent: "teal",
  textSize: "medium",
  systemDark: false,
  sidenavCollapsed: true,

  currentUser: "emma",

  showAppearance: false,
  showRoleSwitcher: false,

  toasts: [],
};

export const PREF_KEYS = ["lang", "theme", "accent", "textSize", "sidenavCollapsed"] as const;
export const PREFS_STORAGE_KEY = "hireos_screening_prefs";
