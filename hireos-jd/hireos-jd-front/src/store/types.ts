import type {
  ActivityItem,
  Approval,
  Audience,
  CommentThread,
  Connection,
  DocumentDraft,
  FileItem,
  Job,
  OpActivity,
  PersonId,
  Publication,
  Requirement,
  RestrictedItem,
  RoleVersion,
  Suggestion,
} from "../data/types";

export type Lang = "en" | "zh";
export type ThemeMode = "light" | "dark" | "deep" | "system";
export type Accent = "blue" | "teal" | "violet";
export type TextSize = "small" | "medium" | "large";
export type WsMode = "editing" | "suggesting" | "viewing";
export type SideTab = "copilot" | "comments" | "changes";

export interface ToastItem {
  id: string;
  msg: string;
  type: "default" | "success" | "error";
  actionLabel?: string;
}

/** A text selection inside the document editor, used to scope Copilot actions. */
export interface DocSelection {
  blockId: string | null;
  text: string;
  scopeLabel?: string;
}

export type CopilotMsg =
  | { kind: "user"; text: string }
  | { kind: "text"; text: string }
  | { kind: "suggestion"; suggestion: Suggestion; explain: string };

export interface GeminiDraft {
  title: string;
  department: string;
  summary?: string;
  responsibilities: string[];
  must: string[];
  pref?: string[];
}

/** A follow-up quick action shown under an assistant message, e.g. "View the created JD" after a job
 * is created from a draft. Scoped to simple client-side navigation for now (no tab-switch-in-place or
 * async-action kinds like the old project's `jd_output`/`candidate_matches` — this app has neither a
 * candidate-matching feature nor an in-canvas document-tab concept to route those into). */
export interface ConversationActionOption {
  id: string;
  label: string;
  href: string;
}

export type GeminiMsg =
  | { role: "user"; text: string }
  | { role: "thinking" }
  | { role: "ai"; text: string; canReplace?: boolean; options?: ConversationActionOption[]; draft?: undefined }
  | { role: "ai"; draft: GeminiDraft; text?: undefined; options?: undefined };

export interface AppState {
  // appearance / chrome
  lang: Lang;
  theme: ThemeMode;
  accent: Accent;
  textSize: TextSize;
  systemDark: boolean;
  sidenavCollapsed: boolean;

  // demo role switching (not real auth)
  currentUserId: PersonId;

  // mutable domain data (the prototype's deep-cloned fixtures)
  jobs: Record<string, Job>;
  roleVersions: Record<string, RoleVersion>;
  requirements: Record<string, Requirement[]>;
  restricted: Record<string, RestrictedItem[]>;
  drafts: Record<string, DocumentDraft>;
  comments: Record<string, CommentThread[]>;
  suggestions: Record<string, Suggestion[]>;
  approvals: Record<string, Approval>;
  publications: Record<string, Publication[]>;
  activity: Record<string, ActivityItem[]>;
  files: FileItem[];
  connections: Connection[];
  opActivity: OpActivity[];

  // job workspace editor state
  wsSelection: DocSelection | null;
  wsSideTab: SideTab;
  wsMode: WsMode;
  wsAudience: Audience;
  wsCurrentJob: string | null;
  wsCopilotThread: CopilotMsg[];

  // Ask Copilot (Gemini-style) panel
  geminiChats: Record<string, GeminiMsg[]>;
  // Backend copilot conversation id bound to each gemini chat key (create-mode only for now).
  geminiConversationIds: Record<string, string>;

  // home page
  homeTrendsOpen: boolean;

  // toast queue
  toasts: ToastItem[];
}
