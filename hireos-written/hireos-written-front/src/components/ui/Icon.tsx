/** Wraps a Material Symbols Rounded ligature name (e.g. "checklist", "quiz") — the same
 * icon font the prototype uses via `<span class="material-icons-o">name</span>`. */
export function Icon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={["material-icons-o", className].filter(Boolean).join(" ")} style={style} aria-hidden="true">
      {name}
    </span>
  );
}
