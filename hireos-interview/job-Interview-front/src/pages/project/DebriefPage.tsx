import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Pill, type Tone } from "../../utils/status";
import { api, type DebriefSummary } from "../../features/project-intake/api";

export function DebriefPage() {
  const { state, set, t } = useStore();
  const zh = state.lang === "zh";
  const [summary, setSummary] = useState<DebriefSummary | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // The decision draft is written from the finished scorecard, so it's generated at the
  // moment the reviewer moves on to Decision — not earlier, when scores could still change.
  const continueToDecision = async () => {
    if (!state.currentTaskId) return;
    setStarting(true); setStartError("");
    try {
      await api(`/tasks/${state.currentTaskId}/decision-draft`, { method: "POST" });
      set({ screen: "decision" });
    } catch (e) {
      const code = e instanceof Error ? e.message : "REQUEST_FAILED";
      setStartError(code === "ROUNDS_NOT_COMPLETED" ? (zh ? "还有轮次未完成，无法生成决定。" : "Some rounds aren't completed yet.")
        : code === "NO_SCORES" ? (zh ? "还没有任何人工评分，无法生成决定。" : "No human scores yet.")
        : code === "NO_CONFIRMED_RUBRIC" ? (zh ? "该职位尚无已确认的评分标准。" : "No confirmed rubric for this role.")
        : code);
    } finally { setStarting(false); }
  };

  useEffect(() => {
    if (!state.currentTaskId) { setSummary(null); return; }
    let active = true; setError("");
    api<DebriefSummary>(`/tasks/${state.currentTaskId}/debrief`)
      .then((value) => { if (active) setSummary(value); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "REQUEST_FAILED"); });
    return () => { active = false; };
  }, [state.currentTaskId]);

  if (!state.currentTaskId) return <div style={{ padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "未关联真实面试任务。" : "No real task linked."}</div>;
  if (error) return <div role="alert" style={{ padding: "12px 15px", border: "1px solid var(--bad)", borderRadius: 12, background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{error}</div>;
  if (!summary) return <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "加载中…" : "Loading…"}</p>;

  const anyUnknown = summary.unknownCards.length > 0;
  const metrics = [
    { label: zh ? "已评分" : "SCORED", value: `${summary.scoredCount} / ${summary.totalCards}`, sub: anyUnknown ? (zh ? `${summary.unknownCards.length} 项仍为未知` : `${summary.unknownCards.length} remain Unknown`) : (zh ? "需求项" : "requirements") },
    { label: zh ? "必须项覆盖" : "MUST-HAVE COVERAGE", value: `${summary.mustHaveMet} / ${summary.mustHaveTotal}`, sub: zh ? "已达标" : "meeting the bar" },
    { label: zh ? "已评分权重" : "EVALUATED WEIGHT", value: `${summary.evaluatedWeightPct}%`, sub: zh ? "占总权重" : "of total rubric" },
    { label: zh ? "总体结果" : "OVERALL SCORE", value: summary.overall == null ? "—" : summary.overall === "pass" ? (zh ? "通过" : "Pass") : (zh ? "未通过" : "Fail"), sub: summary.overall == null ? (zh ? "部分评分 — 见下方" : "partial — see below") : (zh ? "所有需求项已评分" : "all requirements scored") },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".05em", color: "var(--ink-3)" }}>{m.label}</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>{m.value}</div>
            <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {anyUnknown && (
        <div style={{ padding: "12px 15px", border: "1px solid var(--warn)", borderRadius: 12, background: "var(--warn-soft)", display: "flex", alignItems: "center", gap: 9 }}>
          <span>⚠</span>
          <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            <b>{t.partialEvalPre}</b> {zh ? "只有所有需求项都评分后才会出现最终加权分数。" : "A final weighted score only appears once every rubric item is scored."}{" "}
            {summary.unknownCards.length} {zh ? "项如下，为未知而非零分：" : "item(s) below are Unknown, not zero:"}{" "}
            {summary.unknownCards.map((c) => c.requirement).join("、")}。
          </div>
        </div>
      )}

      {summary.cards.map((c) => {
        const tone: Tone = c.score == null ? "unknown" : c.cardPriority === "P0" && c.score < 3 ? "bad" : "ok";
        return (
          <div key={c.id} style={{ padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: tone === "ok" ? "var(--ok-soft)" : tone === "bad" ? "var(--bad-soft)" : "var(--surface-3)", color: tone === "ok" ? "var(--ok)" : tone === "bad" ? "var(--bad)" : "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
              {c.score == null ? "?" : c.score}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.requirement}</div>
              <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>{(c.cardPriority === "P0" ? (zh ? "必须项" : "Must-have") : c.cardPriority) + " · " + (zh ? "权重" : "Weight") + " " + c.weight + "%"}</div>
            </div>
            <Pill label={tone === "unknown" ? (zh ? "未知" : "Unknown") : tone === "bad" ? (zh ? "未达标" : "Below bar") : (zh ? "已达标" : "Meets bar")} tone={tone} />
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-2)", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }} />
        <button onClick={() => set({ screen: "review" })} style={{ height: 34, padding: "0 12px", border: "1px solid transparent", borderRadius: 11, background: "transparent", color: "var(--ink-2)", fontSize: 12.5, cursor: "pointer" }}>{t.backToReview}</button>
        {startError && <span role="alert" style={{ fontSize: 11.5, color: "var(--bad)" }}>{startError}</span>}
        <button disabled={starting} onClick={() => void continueToDecision()} style={{ height: 34, padding: "0 15px", border: "1px solid var(--brand)", borderRadius: 11, background: "var(--brand)", color: "var(--brand-ink)", fontSize: 12.5, fontWeight: 600, cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.6 : 1 }}>{starting ? (zh ? "正在准备决定…" : "Preparing decision…") : t.continueToDecision}</button>
      </div>
    </>
  );
}
