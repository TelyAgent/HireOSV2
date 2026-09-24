import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import { getPerson } from "../../data/fixtures/people";
import { Icon } from "./Icons";

/* ---------------------------------------------------------------
   Buttons
   --------------------------------------------------------------- */
type Variant = "primary" | "secondary" | "text" | "danger" | "danger-solid" | "icon";

export function Button({
  variant = "secondary",
  size,
  children,
  className,
  ...rest
}: { variant?: Variant; size?: "sm" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   Badges — ported from the prototype's `statusBadge(kind, raw)`.
   The label is translated via the store; the tone class is not.
   --------------------------------------------------------------- */
type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "ai";

const BADGE_MAP: Record<string, Record<string, [string, Tone]>> = {
  hiring_status: {
    draft: ["Draft", "neutral"],
    published: ["Published", "success"],
  },
  approval_status: {
    not_submitted: ["Not submitted", "neutral"],
    pending: ["Pending", "warning"],
    changes_requested: ["Changes requested", "warning"],
    rejected: ["Rejected", "danger"],
    approved: ["Approved", "success"],
    cancelled: ["Cancelled", "neutral"],
    superseded: ["Superseded", "neutral"],
  },
  activation_status: {
    not_requested: ["Not requested", "neutral"],
    pending: ["Activation pending", "warning"],
    succeeded: ["Active", "success"],
    failed: ["Activation failed", "danger"],
    outcome_unknown: ["Checking activation status", "warning"],
  },
  publication_status: {
    not_published: ["Not published", "neutral"],
    queued: ["Queued", "info"],
    publishing: ["Publishing", "info"],
    published: ["Published", "success"],
    failed: ["Failed", "danger"],
    outcome_unknown: ["Delivery status unknown", "warning"],
    withdrawal_pending: ["Withdrawal pending", "warning"],
    withdrawn: ["Withdrawn", "neutral"],
  },
  task_status: {
    open: ["Open", "info"],
    in_progress: ["In progress", "info"],
    waiting: ["Waiting", "warning"],
    completed: ["Completed", "success"],
    cancelled: ["Cancelled", "neutral"],
  },
  priority: {
    low: ["Low", "neutral"],
    normal: ["Normal", "neutral"],
    high: ["High", "warning"],
    urgent: ["Urgent", "danger"],
  },
  connection_status: {
    not_connected: ["Not connected", "neutral"],
    connected: ["Connected", "success"],
    paused: ["Paused", "warning"],
    disconnected: ["Disconnected", "neutral"],
    authorization_required: ["Authorization required", "danger"],
  },
  file_consumption: {
    unassigned: ["Unassigned", "warning"],
    pending: ["Pending", "neutral"],
    accepted: ["Accepted", "success"],
    needs_review: ["Needs review", "warning"],
    rejected: ["Rejected", "danger"],
    failed: ["Failed", "danger"],
  },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ kind, value }: { kind: keyof typeof BADGE_MAP | string; value?: string | null }) {
  const { t } = useStore();
  const entry = value ? BADGE_MAP[kind]?.[value] : undefined;
  if (!entry) return <Badge tone="neutral">{t(value || "Unknown")}</Badge>;
  // Statuses share words across kinds ("Open" the hiring status vs. the task
  // status), so the translation key is namespaced by kind.
  return <Badge tone={entry[1]}>{t(entry[0], `${kind}.${entry[0]}`)}</Badge>;
}

export function PriorityBadge({ value }: { value?: string | null }) {
  return <StatusBadge kind="priority" value={value} />;
}

/* ---------------------------------------------------------------
   People
   --------------------------------------------------------------- */
export function PersonAvatar({ id, size = "sm" }: { id?: string | null; size?: "sm" | "md" }) {
  const p = getPerson(id);
  if (!p) return null;
  return (
    <span className={size === "md" ? "avatar-md" : "avatar-sm"} style={{ background: p.color }} title={p.name}>
      {p.initials}
    </span>
  );
}

export function PersonChip({ id }: { id?: string | null }) {
  const { t } = useStore();
  if (!id) return <span className="tiny">{t("Unassigned")}</span>;
  const p = getPerson(id);
  if (!p) return <span className="tiny">{t("Unknown")}</span>;
  return (
    <span className="flex items-center gap-6">
      <PersonAvatar id={id} />
      <span>{p.name}</span>
    </span>
  );
}

/* ---------------------------------------------------------------
   Page fragments
   --------------------------------------------------------------- */
export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="breadcrumbs">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.label + i} style={{ display: "contents" }}>
            {i > 0 && (
              <span className="sep material-icons-o" style={{ fontSize: 14 }} aria-hidden="true">
                chevron_right
              </span>
            )}
            {isLast || !c.to ? (
              <span className={isLast ? "current" : undefined}>{c.label}</span>
            ) : (
              <Link to={c.to}>{c.label}</Link>
            )}
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
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
}) {
  return (
    <>
      {crumbs && crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}
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
  icon,
  title,
  body,
  actions,
}: {
  icon: string;
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

export function ErrorState({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <div className="error-inline">
      <Icon name="error" />
      <div>
        <strong>{title}</strong>
        {body && <div>{body}</div>}
      </div>
    </div>
  );
}

export function InlineNote({
  tone = "info",
  icon,
  children,
  style,
}: {
  tone?: "info" | "warning" | "error";
  icon: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className={`${tone === "info" ? "info" : tone === "warning" ? "warning" : "error"}-inline`} style={style}>
      <Icon name={icon} />
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   Toasts
   --------------------------------------------------------------- */
export function ToastStack() {
  const { state, toastAction } = useStore();
  return (
    <div className="toast-stack">
      {state.toasts.map((toast) => (
        <div key={toast.id} className={`toast${toast.type !== "default" ? " " + toast.type : ""}`}>
          <span>{toast.msg}</span>
          {toast.actionLabel && (
            <button className="toast-action" onClick={() => toastAction(toast.id)}>
              {toast.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
