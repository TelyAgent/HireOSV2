import { toneFg, type Tone } from "../utils/status";
import type { SummaryPoint } from "../features/project-intake/api";

/** A titled list of AI-cited points, each with the verbatim quote it rests on. */
export function SummaryPoints({ title, points, tone }: { title: string; points: SummaryPoint[]; tone: Tone }) {
  if (!points.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: toneFg[tone] }}>{title}</div>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
        {points.map((p, i) => (
          <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink)" }}>
            {p.point}
            <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic" }}>&ldquo;{p.quote}&rdquo;</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
