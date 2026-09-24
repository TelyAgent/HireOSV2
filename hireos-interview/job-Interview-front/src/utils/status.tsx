import { useStore } from "../store/StoreContext";
import { COMPS as COMPS_LIST } from "../data/comps";
import type { Competency } from "../data/comps";

export type Tone = "ok" | "warn" | "bad" | "unknown";

export const toneBg: Record<Tone, string> = {
  ok: "var(--ok-soft)",
  warn: "var(--warn-soft)",
  bad: "var(--bad-soft)",
  unknown: "var(--surface-3)",
};

export const toneFg: Record<Tone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  unknown: "var(--ink-2)",
};

export function toneStyle(tone: Tone): React.CSSProperties {
  return {
    background: toneBg[tone],
    color: toneFg[tone],
  };
}

interface PillProps {
  label: string;
  tone: Tone | "none" | "none2";
}

export function Pill({ label, tone }: PillProps) {
  const t: Tone = tone === "none" || tone === "none2" ? "unknown" : tone;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: toneBg[t],
        color: toneFg[t],
      }}
    >
      {label}
    </span>
  );
}

// Returns the human score for a competency id, or null
export function useHumanScore(id: string): number | null {
  const { state, r1Scores } = useStore();
  const comp = COMPS_LIST.find((c) => c.id === id);
  if (!comp) return null;

  if (state.jdOnlyDraft) {
    if (comp.round === "r1" && !state.r1Done) return null;
    if (comp.round === "r2" && !state.r2Done) return null;
  }

  if (comp.round === "r1") return r1Scores[id] ?? null;
  return state.r2Scores[id] ?? null;
}

export function useTone(id: string): Tone {
  const score = useHumanScore(id);
  if (score == null) return "unknown";
  const comp = COMPS_LIST.find((c) => c.id === id);
  if (!comp) return "ok";
  return comp.must && score < comp.req ? "bad" : "ok";
}

export function compName(
  c: Competency | undefined,
  lang: "en" | "zh",
): string {
  if (!c) return "";
  return lang === "zh" ? c.nameZh || c.name : c.name;
}

export function compJd(c: Competency | undefined, lang: "en" | "zh"): string {
  if (!c) return "";
  return lang === "zh" ? c.jdZh || c.jd : c.jd;
}