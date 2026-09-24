import type { CSSProperties } from "react";

/**
 * Material Symbols Rounded glyph, matching the prototype's
 * `<span class="material-icons-o">name</span>`.
 */
export function Icon({
  name,
  size,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`material-icons-o${className ? " " + className : ""}`}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
