import { useEffect } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Icon } from "./Icons";
import { useStore } from "../../store/StoreContext";
import { initialsOf, type Person } from "../../data/fixtures/people";
import type { Task } from "../../data/fixtures/tasks";

/* ---------------------------------------------------------------
   Buttons
   --------------------------------------------------------------- */
type ButtonVariant = "primary" | "secondary" | "text" | "danger" | "danger-solid" | "icon";

export function Button({
  variant = "secondary",
  size,
  icon,
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm";
  icon?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className].filter(Boolean).join(" ");
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   Badges / chips / status
   --------------------------------------------------------------- */
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "outline";

export function Badge({ tone = "neutral", children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

const ELIG_TONE: Record<string, BadgeTone> = {
  eligible: "success",
  likely_eligible: "success",
  needs_verification: "warning",
  not_eligible: "danger",
};
const ELIG_LABEL: Record<string, string> = {
  eligible: "Eligible",
  likely_eligible: "Likely eligible",
  needs_verification: "Needs verification",
  not_eligible: "Not eligible",
};
export function EligibilityBadge({ status }: { status?: string | null }) {
  const { t } = useStore();
  if (!status) return <Badge tone="neutral">{t("Unknown")}</Badge>;
  return <Badge tone={ELIG_TONE[status] ?? "neutral"}>{t(ELIG_LABEL[status] ?? status)}</Badge>;
}

const REC_TONE: Record<string, BadgeTone> = {
  strong_advance: "success",
  advance: "success",
  review: "warning",
  hold: "neutral",
  do_not_advance: "danger",
};
const REC_LABEL: Record<string, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  review: "Review",
  hold: "Hold",
  do_not_advance: "Do not advance",
};
export function RecommendationBadge({ outcome }: { outcome?: string | null }) {
  const { t } = useStore();
  if (!outcome) return <Badge tone="neutral">—</Badge>;
  return <Badge tone={REC_TONE[outcome] ?? "neutral"}>{t(REC_LABEL[outcome] ?? outcome)}</Badge>;
}

const PRIORITY_TONE: Record<string, BadgeTone> = {
  urgent: "danger",
  high: "warning",
  normal: "neutral",
  low: "outline",
};
export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useStore();
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"}>{t(label)}</Badge>;
}

export function TaskStatusBadge({ task }: { task: Task }) {
  const { t } = useStore();
  if (task.status === "completed") return <Badge tone="success">{t("Completed")}</Badge>;
  if (task.status === "cancelled") return <Badge tone="outline">{t("Cancelled")}</Badge>;
  if (task.status === "waiting") return <Badge tone="neutral">{t("Waiting")}</Badge>;
  if (task.needsRefresh) return <Badge tone="warning">{t("Needs refresh")}</Badge>;
  const overdue = task.dueAt && new Date(task.dueAt).getTime() < Date.now();
  if (overdue) return <Badge tone="danger">{t("Overdue")}</Badge>;
  return <Badge tone="info">{task.status === "in_progress" ? t("In progress") : t("Open")}</Badge>;
}

export function FreshnessBadge({ freshness }: { freshness?: "current" | "stale" | "restricted" | "withdrawn" | null }) {
  const { t } = useStore();
  if (!freshness || freshness === "current") return null;
  if (freshness === "stale")
    return (
      <Badge tone="warning" title={t("Inputs changed since this result was generated")}>
        {t("Stale — refresh available")}
      </Badge>
    );
  if (freshness === "restricted") return <Badge tone="danger">{t("Restricted")}</Badge>;
  return <Badge tone="outline">{t("Withdrawn")}</Badge>;
}

/* ---------------------------------------------------------------
   Avatars
   --------------------------------------------------------------- */
export function PersonAvatar({ person, size }: { person: Person | null; size?: "sm" | "md" }) {
  const cls = size === "md" ? "avatar-md" : size === "sm" ? "avatar-sm" : "avatar";
  if (!person) return <span className={cls} style={{ background: "var(--border-strong)" }}>?</span>;
  return (
    <span className={cls} style={{ background: person.color }} title={person.name}>
      {person.initials || initialsOf(person.name)}
    </span>
  );
}

const CANDIDATE_COLORS = ["#1a73e8", "#188038", "#8430ce", "#d93025", "#e37400", "#12805c", "#b31412", "#3949ab"];
export function candidateColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CANDIDATE_COLORS[h % CANDIDATE_COLORS.length];
}
export function CandidateAvatar({ id, name, size }: { id: string; name: string; size?: "sm" | "md" }) {
  const cls = size === "md" ? "avatar-md" : size === "sm" ? "avatar-sm" : "avatar";
  return (
    <span className={cls} style={{ background: candidateColor(id) }}>
      {initialsOf(name)}
    </span>
  );
}

/* ---------------------------------------------------------------
   Page chrome
   --------------------------------------------------------------- */
export interface CrumbItem {
  label: string;
  href?: string;
}
export function Breadcrumbs({ items }: { items: CrumbItem[] }) {
  return (
    <div className="breadcrumbs">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        if (isLast) return <span className="current" key={it.label}>{it.label}</span>;
        return (
          <span key={it.label} style={{ display: "contents" }}>
            {it.href ? <RouterLink to={it.href}>{it.label}</RouterLink> : <span>{it.label}</span>}
            <span className="sep">/</span>
          </span>
        );
      })}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  crumbs,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: CrumbItem[];
}) {
  return (
    <>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  body,
  actions,
}: {
  icon?: string;
  title: string;
  body?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name={icon} />
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------
   Score / coverage visuals
   --------------------------------------------------------------- */
export function scoreDisplay(n: number | null | undefined): number | null {
  return n == null ? null : Math.round(n);
}
export function ScoreRing({ overall, size }: { overall: number | null | undefined; size?: "sm" }) {
  const s = scoreDisplay(overall);
  const style: React.CSSProperties = size === "sm" ? { width: 30, height: 30, fontSize: 11 } : {};
  if (s == null) return <span className="score-ring unk" style={style}>—</span>;
  const bg = s >= 75 ? "var(--score-high)" : s >= 55 ? "var(--score-mid)" : "var(--score-low)";
  return (
    <span className="score-ring" style={{ background: bg, ...style }}>
      {s}
    </span>
  );
}
export function CoverageBar({ coverage }: { coverage: number | null | undefined }) {
  const p = coverage == null ? 0 : Math.round(coverage * 100);
  return (
    <div className="flex items-center gap-8">
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${p}%` }} />
      </div>
      <span className="tiny mono">{p}%</span>
    </div>
  );
}

/* ---------------------------------------------------------------
   Tabs
   --------------------------------------------------------------- */
export function PillTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="pill-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`pill-tab${tab.key === active ? " active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="underline-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`u-tab${tab.key === active ? " active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count != null && <span className="cnt"> ({tab.count})</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Surfaces
   --------------------------------------------------------------- */
export function Card({ padded = true, className, children }: { padded?: boolean; className?: string; children: ReactNode }) {
  return <div className={["card", padded ? "card-pad" : "", className].filter(Boolean).join(" ")}>{children}</div>;
}

/* ---------------------------------------------------------------
   Toasts (rendered once at app root)
   --------------------------------------------------------------- */
export function ToastStack() {
  const { state, dismissToast, toastAction } = useStore();
  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="true">
      {state.toasts.map((toastItem) => (
        <div className={`toast ${toastItem.type}`} key={toastItem.id}>
          <span>{toastItem.msg}</span>
          {toastItem.actionLabel && (
            <button className="toast-action" onClick={() => toastAction(toastItem.id)}>
              {toastItem.actionLabel}
            </button>
          )}
          <button
            className="close-x"
            style={{ color: "inherit" }}
            aria-label="Dismiss"
            onClick={() => dismissToast(toastItem.id)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Misc
   --------------------------------------------------------------- */
export function useEffectOnce(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
