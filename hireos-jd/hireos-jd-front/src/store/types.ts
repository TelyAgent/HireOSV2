import type { AiAnalysis } from "../features/workspace/documentsApi";
import type { JdVersions } from "../features/workspace/versions";
import type { CopilotJdFields } from "../features/copilot/copilotApi";
import type { MoneyRange } from "../lib/format";
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
  location?: string;
  headcount?: number;
  employmentType?: string;
  summary?: string;
  responsibilities: string[];
  must: string[];
  pref?: string[];
  compensation?: MoneyRange;
  businessProblem?: string;
  outcomes?: string[];
  success?: string[];
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

/** The five ways into "Create a job" on the Copilot home screen; `home` means free-form chat. */
export type GeminiCreatePath = "home" | "questions" | "title" | "upload" | "link" | "form";

export interface GeminiVariant {
  key: string;
  label: string;
  description: string;
  fields: CopilotJdFields;
}

/** Where a draft came from — shown as the Workspace's source badge and "Captured inputs". */
export interface GeminiOrigin {
  path: GeminiCreatePath;
  detail?: string;
}

export type GeminiMsg =
  | { role: "user"; text: string }
  | { role: "thinking" }
  | { role: "ai"; text: string; options?: ConversationActionOption[]; draft?: undefined; kind?: undefined }
  /** A complete JD draft. `prev` is the draft it refined (for change highlights); `created` once a job was made from it. */
  | {
      role: "ai";
      draft: GeminiDraft;
      prev?: GeminiDraft;
      origin?: GeminiOrigin;
      superseded?: boolean;
      created?: boolean;
      text?: undefined;
      options?: undefined;
      kind?: undefined;
    }
  /** Inline prompt card for a path: the upload button or the manual form. `done` once used. */
  | { role: "ai"; kind: "upload"; text: string; done?: boolean }
  | { role: "ai"; kind: "form"; text: string; done?: boolean }
  /** Creating the job failed (#34): nothing was saved, the reason is shown and `retry` re-runs the same create. `done` once retried. */
  | { role: "ai"; kind: "create-failed"; text: string; retry: GeminiCreateRetry; done?: boolean }
  /** An AI request failed (#33): plain-language reason, Retry re-sends `retry` (when it can be replayed), Start over resets. */
  | { role: "ai"; kind: "request-failed"; text: string; retry?: GeminiRequestRetry; done?: boolean }
  /** "Start with a job title" result: three styles to pick from. `picked` once a job was created from one. */
  | {
      role: "ai";
      kind: "variants";
      title: string;
      variants: GeminiVariant[];
      selected?: number;
      prev?: GeminiVariant[];
      origin?: GeminiOrigin;
      superseded?: boolean;
      picked?: number;
    };

/** What a "create job" attempt needs to be re-run from a failure card (kept serializable — chats are persisted). */
export type GeminiCreateRetry =
  | { source: "fields"; fields: CopilotJdFieldsLike; label: string; seniority?: string; formIndex?: number; variant?: { index: number; variantIndex: number } }
  | { source: "draft"; draftIndex: number; draft: GeminiDraft };
/** What a failed AI request needs to be re-sent with the user's original input (kept serializable). */
export type GeminiRequestRetry =
  | { action: "chat" | "questions" | "title" | "link"; text: string }
  | { action: "refine"; text: string; index: number }
  /** Uploads can't be replayed from storage; Retry re-opens the file picker. */
  | { action: "upload"; fileName: string };
/** Structural stand-in for `CopilotJdFields` (store types don't import feature modules). */
export type CopilotJdFieldsLike = Record<string, unknown>;

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
  /** Whether the backend job list has arrived yet (#35): "loading" must not read as "no jobs". */
  jobsLoad: { status: "loading" | "loaded" | "failed"; error?: string };
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
  // Which create path each gemini chat is on — decides how the composer's next input is handled.
  geminiCreatePaths: Record<string, GeminiCreatePath>;

  // home page
  homeTrendsOpen: boolean;
}
