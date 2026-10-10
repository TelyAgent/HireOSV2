import type { AiAnalysis } from "../features/workspace/documentsApi";
import type { JdVersions } from "../features/workspace/versions";
import type {
  ActivityItem,
  Approval,
  CommentThread,
  DocBlock,
  DocumentDraft,
  FileItem,
  Job,
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
export type SideTab = "copilot" | "analysis";

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
  | { role: "ai"; text: string; options?: ConversationActionOption[]; draft?: undefined }
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

  // job workspace editor state
  wsSelection: DocSelection | null;
  wsSideTab: SideTab;
  wsCurrentJob: string | null;
  wsCopilotThread: CopilotMsg[];
  /** A Copilot document rewrite request is in flight. */
  wsCopilotBusy: boolean;
  /** Block the cursor is in; Copilot falls back to it when no text is selected. */
  wsFocusBlockId: string | null;
  /** Bumped to ask the open document to save itself (e.g. after accepting a suggestion). */
  wsSaveRequest: number;
  /** When Analyze was last run per job (shows optional-section suggestions). */
  wsAnalyzedAt: Record<string, number>;
  /** Ask the open document to focus a block (from the Analysis panel's "Fill in"); `n` makes repeats distinct. */
  wsFocusRequest: { blockId: string; n: number } | null;
  /** Latest AI analysis per job, with the document revision it was run on (to flag it as outdated). */
  wsAiAnalysis: Record<string, { at: number; revision: number; result: AiAnalysis }>;
  /** Completeness-AI requests in flight, keyed `${jobId}:${what}`. */
  wsAiBusy: Record<string, boolean>;
  /** Document before the last AI edit, for Undo. */
  wsAiUndo: { jobId: string; blocks: DocBlock[]; label: string } | null;
  /** JD ID and published versions per job, as loaded from the backend. */
  wsVersions: Record<string, JdVersions>;

  // Ask Copilot (Gemini-style) panel
  geminiChats: Record<string, GeminiMsg[]>;
  // Backend copilot conversation id bound to each gemini chat key (create-mode only for now).
  geminiConversationIds: Record<string, string>;

  // home page
  homeTrendsOpen: boolean;
}
