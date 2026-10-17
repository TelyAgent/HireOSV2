import { useEffect } from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icons";
import { useGoBack } from "../../lib/navigation";
import { useStore } from "../../store/StoreContext";
import { initialsOf, type Person } from "../../data/fixtures/people";

/* ---------------------------------------------------------------
   Buttons
   --------------------------------------------------------------- */
type ButtonVariant = "primary" | "secondary" | "text" | "danger" | "danger-solid" | "icon";

export function Button({
  variant = "secondary",
  size,
  icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm";
  icon?: string;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <Icon name="progress_activity" className="btn-spinner" /> : icon && <Icon name={icon} />}
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
/** The AI recommendation as every page shows it (F08 BR-6): the shared rule's outcome, with "insufficient
 * evidence" said only when that is the reason. */
export function AiRecommendationBadge({ display }: { display: { outcome: string; insufficientEvidence: boolean } | null }) {
  const { t } = useStore();
  if (display?.insufficientEvidence) return <Badge tone="warning">{t("Review (insufficient evidence)")}</Badge>;
  return <RecommendationBadge outcome={display?.outcome} />;
}

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
/** History-aware back arrow — see `useGoBack`. `fallback` is used only without in-app history. */
export function BackButton({ fallback, style }: { fallback: string; style?: CSSProperties }) {
  const { t } = useStore();
  const goBack = useGoBack(fallback);
  return (
    <button type="button" className="breadcrumb-back" style={{ marginBottom: 10, ...style }} title={t("Back")} aria-label={t("Back")} onClick={goBack}>
      <Icon name="arrow_back" />
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  crumbs,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Shows a back arrow; the value is the fallback parent route when there's no history. */
  back?: string;
  /** Where this page sits, e.g. Jobs › a job › Compare (#209); the last one is this page and has no link. */
  crumbs?: Array<{ label: string; to?: string }>;
}) {
  return (
    <>
      {back && <BackButton fallback={back} />}
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="breadcrumbs">
          <ol>
            {crumbs.map((crumb, i) => (
              <li key={i}>
                {crumb.to && i < crumbs.length - 1 ? <Link to={crumb.to}>{crumb.label}</Link> : <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
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
   Misc
   --------------------------------------------------------------- */
export function useEffectOnce(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
