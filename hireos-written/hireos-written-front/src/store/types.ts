export type Lang = "en" | "zh";
export type ThemeMode = "light" | "dark" | "deep" | "system";
export type Accent = "blue" | "teal" | "violet";
export type TextSize = "small" | "medium" | "large";
export type ShellMode = "standalone" | "shell";
export type UserId = "user_john" | "user_daniel" | "user_morgan" | "user_sam";

export interface ToastItem {
  id: string;
  msg: string;
  type: "default" | "success" | "danger";
}

export interface AppState {
  // appearance
  lang: Lang;
  theme: ThemeMode;
  accent: Accent;
  textSize: TextSize;
  systemDark: boolean;
  sidebarCollapsed: boolean;

  // demo role switching (not real auth — mirrors the prototype's role pill)
  currentUser: UserId;
  shellMode: ShellMode;

  // app-shell-level overlays
  showAppearance: boolean;
  showRoleSwitcher: boolean;

  // demo clock offset in minutes, relative to the fixed demo base instant
  clockOffsetMin: number;

  // toast queue
  toasts: ToastItem[];
}
