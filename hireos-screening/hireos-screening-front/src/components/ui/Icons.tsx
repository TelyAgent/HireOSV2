/**
 * The prototype renders every icon as a Material Symbols Rounded ligature
 * (`<span class="material-icons-o">icon_name</span>`). We keep that exact
 * approach — one component, icon name as a string — instead of hand-rolling
 * SVGs, since it's what the source design system actually uses everywhere
 * (buttons, nav, badges, empty states).
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
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-icons-o${className ? ` ${className}` : ""}`}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
