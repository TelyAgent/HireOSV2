import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./Icon";
import { useStore } from "../../store/StoreContext";

/* ---------------------------------------------------------------
   Buttons
   --------------------------------------------------------------- */
type ButtonVariant = "default" | "primary" | "danger" | "ghost";

export function Button({
  variant = "default",
  size,
  icon,
  className,
  children,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: "sm";
  icon?: string;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ["btn", variant !== "default" ? variant : "", size === "sm" ? "sm" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   Badges
   --------------------------------------------------------------- */
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

/* ---------------------------------------------------------------
   Layout
   --------------------------------------------------------------- */
export interface CrumbItem { label: string; href?: string }

export function Breadcrumbs({ items }: { items: CrumbItem[] }) {
  const { t } = useStore();
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="sep">/</span>}
          {item.href && i < items.length - 1 ? (
            <Link to={item.href}>{t(item.label)}</Link>
          ) : (
            <span className="current">{t(item.label)}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({ title, crumbs, actions }: { title: ReactNode; crumbs?: CrumbItem[]; actions?: ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex items-center justify-between gap-3" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1>{title}</h1>
        {actions && <div style={{ display: "flex", gap: 8, flex: "none" }}>{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ padded = true, className, children, style }: { padded?: boolean; className?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={["card", padded ? "card-pad" : "", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, sub }: { icon?: string; title: string; sub?: string }) {
  const { t } = useStore();
  return (
    <div className="empty">
      {icon && <div className="big material-icons-o">{icon}</div>}
      <div>{t(title)}</div>
      {sub && <div className="tiny" style={{ marginTop: 4 }}>{t(sub)}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------
   Tabs
   --------------------------------------------------------------- */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const { t } = useStore();
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} type="button" className={`tab ${o.value === value ? "active" : ""}`} onClick={() => onChange(o.value)}>
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Toast host
   --------------------------------------------------------------- */
export function ToastHost() {
  const { state, dismissToast } = useStore();
  if (!state.toasts.length) return null;
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 300, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      {state.toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type === "success" ? "success" : toast.type === "danger" ? "danger" : ""}`}
          style={{
            background: toast.type === "success" ? "#137333" : toast.type === "danger" ? "#C5221F" : "var(--text-primary)",
            color: "var(--surface)", boxShadow: "var(--shadow-2)", borderRadius: 12, padding: "12px 16px",
            fontSize: 12.5, display: "flex", alignItems: "center", gap: 14, minWidth: 280, maxWidth: 520, cursor: "pointer",
          }}
          onClick={() => dismissToast(toast.id)}
        >
          <span>{toast.msg}</span>
        </div>
      ))}
    </div>
  );
}
