import type { PersonId } from "../data/fixtures/people";

export type Lang = "en" | "zh";
export type ThemeMode = "light" | "dark" | "deep" | "system";
export type Accent = "blue" | "teal" | "violet";
export type TextSize = "small" | "medium" | "large";

export interface ToastItem {
  id: string;
  msg: string;
  type: "default" | "success" | "info" | "error";
  actionLabel?: string;
}

export interface AppState {
  // appearance
  lang: Lang;
  theme: ThemeMode;
  accent: Accent;
  textSize: TextSize;
  systemDark: boolean;
  sidenavCollapsed: boolean;

  // demo role switching (not real auth — see PRD "Design Brief" note)
  currentUser: PersonId;

  // app-shell-level overlays (page-local modals live in their own components)
  showAppearance: boolean;
  showRoleSwitcher: boolean;

  // toast queue
  toasts: ToastItem[];
}
