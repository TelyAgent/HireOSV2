import type { AppState } from "./types";

export const initialState: AppState = {
  lang: "en",
  theme: "light",
  accent: "teal",
  textSize: "medium",
  systemDark: false,
  sidebarCollapsed: true,

  currentUser: "user_john",

  showAppearance: false,
  showRoleSwitcher: false,

  clockOffsetMin: 0,

  toasts: [],
  realTasksVersion: 0,
  bankQuestionsVersion: 0,
};

export const PREF_KEYS = ["lang", "theme", "accent", "textSize", "sidebarCollapsed", "currentUser"] as const;
export const PREFS_STORAGE_KEY = "hireos_written_prefs";
