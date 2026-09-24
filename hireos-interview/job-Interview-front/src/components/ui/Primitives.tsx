import { useEffect, useState, type ReactNode } from "react";

export function useEffectOnce(fn: () => void) {
  useEffect(() => {
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

interface ToastProps {
  text: string;
}

export function Toast({ text }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (text) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [text]);

  if (!text || !visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        maxWidth: 520,
        padding: "12px 16px",
        borderRadius: 12,
        background: "var(--ink)",
        color: "var(--surface)",
        fontSize: 12.5,
        lineHeight: 1.5,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        zIndex: 50,
      }}
    >
      {text}
    </div>
  );
}

interface SectionTitleProps {
  children: ReactNode;
}

export function SectionTitle({ children }: SectionTitleProps) {
  return (
    <div
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 10.5,
        letterSpacing: ".05em",
        color: "var(--ink-3)",
      }}
    >
      {children}
    </div>
  );
}

interface SurfaceCardProps {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  padding?: number | string;
  bordered?: boolean;
}

export function SurfaceCard({
  children,
  style,
  padding = "16px 18px",
  bordered = true,
}: SurfaceCardProps) {
  return (
    <div
      style={{
        border: bordered ? "1px solid var(--line)" : "none",
        borderRadius: 14,
        background: "var(--surface)",
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface BannerProps {
  tone: "warn" | "ok" | "brand" | "bad" | "ai";
  children: ReactNode;
  actions?: ReactNode;
  style?: React.CSSProperties;
}

export function Banner({ tone, children, actions, style }: BannerProps) {
  const toneConfig = {
    warn: { border: "var(--warn)", bg: "var(--warn-soft)" },
    ok: { border: "var(--ok)", bg: "var(--ok-soft)" },
    brand: { border: "var(--brand)", bg: "var(--brand-soft)" },
    bad: { border: "var(--bad)", bg: "var(--bad-soft)" },
    ai: { border: "var(--ai)", bg: "var(--ai-soft)" },
  }[tone];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "11px 14px",
        border: `1px solid ${toneConfig.border}`,
        borderRadius: 12,
        background: toneConfig.bg,
        fontSize: 12.5,
        lineHeight: 1.45,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      {actions}
    </div>
  );
}

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  tone?: "default" | "warn" | "ok" | "bad" | "brand";
}

export function Chip({
  label,
  active = false,
  onClick,
  size = "md",
  tone = "default",
}: ChipProps) {
  const heights = { sm: 26, md: 30 } as const;
  const fonts = { sm: 11.5, md: 12 } as const;
  const palette =
    tone === "warn"
      ? { border: "var(--warn)", bg: "var(--warn-soft)", color: "var(--warn)" }
      : active
        ? {
            border: "var(--brand)",
            bg: "var(--brand-soft)",
            color: "var(--brand)",
          }
        : {
            border: "var(--line)",
            bg: "var(--surface)",
            color: "var(--ink-2)",
          };
  return (
    <button
      onClick={onClick}
      style={{
        height: heights[size],
        padding: size === "sm" ? "0 10px" : "0 12px",
        border: `1px solid ${palette.border}`,
        borderRadius: 9,
        background: palette.bg,
        color: palette.color,
        fontSize: fonts[size],
        fontWeight: active || tone !== "default" ? 600 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  disabled?: boolean;
}

export function PrimaryButton({
  children,
  onClick,
  size = "md",
  icon,
  disabled,
}: PrimaryButtonProps) {
  const heights = { sm: 30, md: 34, lg: 40 } as const;
  const fonts = { sm: 12, md: 12.5, lg: 13.5 } as const;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        height: heights[size],
        padding: size === "lg" ? "0 18px" : "0 15px",
        border: "1px solid var(--brand)",
        borderRadius: size === "lg" ? 10 : 11,
        background: disabled ? "var(--surface-3)" : "var(--brand)",
        color: disabled ? "var(--ink-3)" : "var(--brand-ink)",
        fontSize: fonts[size],
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
      }}
    >
      {children}
      {icon}
    </button>
  );
}

interface SecondaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  size?: "sm" | "md";
  variant?: "default" | "ghost";
}

export function SecondaryButton({
  children,
  onClick,
  size = "md",
  variant = "default",
}: SecondaryButtonProps) {
  const heights = { sm: 26, md: 32 } as const;
  const fonts = { sm: 11.5, md: 12.5 } as const;
  return (
    <button
      onClick={onClick}
      style={{
        height: heights[size],
        padding: "0 11px",
        border: `1px solid ${
          variant === "ghost" ? "transparent" : "var(--line)"
        }`,
        borderRadius: 9,
        background: variant === "ghost" ? "transparent" : "var(--surface)",
        color: variant === "ghost" ? "var(--ink-2)" : "var(--ink-2)",
        fontSize: fonts[size],
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

interface GhostButtonProps {
  children: ReactNode;
  onClick?: () => void;
  size?: "sm" | "md";
  color?: "ink" | "ink-2" | "ink-3" | "brand";
  underline?: boolean;
}

export function GhostButton({
  children,
  onClick,
  size = "md",
  color = "ink-2",
  underline,
}: GhostButtonProps) {
  const fonts = { sm: 11.5, md: 12.5 } as const;
  return (
    <button
      onClick={onClick}
      style={{
        height: size === "sm" ? 26 : 32,
        padding: "0 4px",
        border: 0,
        background: "transparent",
        color: `var(--${color})`,
        fontSize: fonts[size],
        fontWeight: 500,
        cursor: "pointer",
        textDecoration: underline ? "underline" : "none",
      }}
    >
      {children}
    </button>
  );
}