import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { useProjectTask } from "../../features/project-intake/useTask";
import { Pill, toneBg, toneFg, type Tone } from "../../utils/status";
import { api, type DebriefCard, type DebriefSummary } from "../../features/project-intake/api";

const panel = { padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" } as const;

function DebriefRow({ card, bar, open, onToggle, zh }: { card: DebriefCard; bar: number; open: boolean; onToggle: () => void; zh: boolean }) {
  const must = card.cardPriority === "P0";
  const tone: Tone = card.score == null ? "unknown" : must && card.score < bar ? "bad" : "ok";
  return (
    <div id={`debrief-${card.id}`} style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" }}>
      <button onClick={onToggle} aria-expanded={open}
        style={{ width: "100%", padding: "13px 16px", border: 0, background: "transparent", display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", color: "inherit" }}>
        <div style={{ flex: "none", width: 36, height: 36, borderRadius: 9, background: toneBg[tone], color: toneFg[tone], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
          {card.score ?? "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{card.requirement}</div>
          <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>
            {(must ? (zh ? "必须项" : "Must-have") : zh ? "标准项" : "Standard") + " · " + (zh ? `要求 L${bar}` : `Required L${bar}`) + " · " + (zh ? `权重 ${card.weight}%` : `Weight ${card.weight}%`)}
          </div>
        </div>
        <Pill label={tone === "unknown" ? (zh ? "未知" : "Unknown") : tone === "bad" ? (zh ? "未达标" : "Below bar") : (zh ? "达标" : "Meets bar")} tone={tone} />
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          <div style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 9, background: "var(--surface-2)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: "var(--ink-3)" }}>
              {zh ? "记录分数（人工）" : "RECORDED (HUMAN)"}{card.round && ` · ${zh ? `第 ${card.round.sequence} 轮` : `Round ${card.round.sequence}`}`}
            </div>
            <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700 }}>{card.score ?? (zh ? "未评分" : "Not scored")}</div>
            {card.note && <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)" }}>{card.note}</div>}
          </div>
          <div style={{ padding: "10px 12px", border: "1px solid var(--ai)", borderRadius: 9, background: "var(--ai-soft)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: "var(--ai)" }}>{zh ? "AI 草稿（跨轮）" : "AI DRAFT (ALL ROUNDS)"}</div>
            {card.ai ? (
              <>
                <div style={{ marginTop: 5, fontSize: 13, fontWeight: 700, color: "var(--ai)" }}>{card.ai.score ?? (zh ? "证据不足" : "Insufficient evidence")}</div>
                <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)" }}>{card.ai.rationale}</div>
                {card.ai.quote && <div style={{ marginTop: 5, fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-3)", fontStyle: "italic" }}>&ldquo;{card.ai.quote}&rdquo;</div>}
              </>
            ) : <div style={{ marginTop: 5, fontSize: 12, color: "var(--ink-3)" }}>{zh ? "暂无 AI 草稿。" : "No AI draft yet."}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function DebriefPage() {
  const { state, set, t } = useStore();
  const { advance, isDone } = useProjectTask();
  const zh = state.lang === "zh";
  const [summary, setSummary] = useState<DebriefSummary | null>(null);
  const [error, setError] = useState("");
  const [pollKey, setPollKey] = useState(0);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // The decision draft is written from the finished scorecard, so it's generated at the
  // moment the reviewer moves on to Decision — not earlier, when scores could still change.
  const continueToDecision = async () => {
    if (!state.currentTaskId) return;
    setStarting(true); setStartError("");
    try {
      await api(`/tasks/${state.currentTaskId}/decision-draft`, { method: "POST" });
      await advance("decision");
    } catch (e) {
      const code = e instanceof Error ? e.message : "REQUEST_FAILED";
      setStartError(code === "ROUNDS_NOT_COMPLETED" ? (zh ? "还有轮次未完成，无法生成决定。" : "Some rounds aren't completed yet.")
        : code === "NO_SCORES" ? (zh ? "还没有任何人工评分，无法生成决定。" : "No human scores yet.")
        : code === "NO_CONFIRMED_RUBRIC" ? (zh ? "该职位尚无已确认的评分标准。" : "No confirmed rubric for this role.")
        : code);
    } finally { setStarting(false); }
  };

  // Polls while the AI cross-round draft (queued by "Continue to debrief") is still running.
  useEffect(() => {
    if (!state.currentTaskId) { setSummary(null); return; }
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    setError("");
    const poll = async () => {
      try {
        const value = await api<DebriefSummary>(`/tasks/${state.currentTaskId}/debrief`);
        if (stopped) return;
        setSummary(value);
        if (value.generation && (value.generation.status === "queued" || value.generation.status === "parsing")) timer = setTimeout(poll, 3000);
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "REQUEST_FAILED"); }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [state.currentTaskId, pollKey]);

  const regenerate = async () => {
    if (!state.currentTaskId) return;
    setDrafting(true); setDraftError("");
    try {
      await api(`/tasks/${state.currentTaskId}/debrief-draft`, { method: "POST" });
      setPollKey((k) => k + 1);
    } catch (e) {
      const code = e instanceof Error ? e.message : "REQUEST_FAILED";
      setDraftError(code === "ROUNDS_NOT_COMPLETED" ? (zh ? "还有轮次未完成，无法生成 AI 草稿。" : "Some rounds aren't completed yet.")
        : code === "NO_TRANSCRIPT" ? (zh ? "所有轮次都没有转写内容，无法生成 AI 草稿。" : "No round has a transcript yet.")
        : code === "NO_CONFIRMED_RUBRIC" ? (zh ? "该职位尚无已确认的评分标准。" : "No confirmed rubric for this role.")
        : code);
    } finally { setDrafting(false); }
  };

  const toggle = (id: string) => setOpenCards((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const showTrace = (id: string) => {
    setOpenCards((prev) => new Set(prev).add(id));
    requestAnimationFrame(() => document.getElementById(`debrief-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  if (!state.currentTaskId) return <div style={{ ...panel, fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "未关联真实面试任务。" : "No real task linked."}</div>;
  if (error) return <div role="alert" style={{ padding: "12px 15px", border: "1px solid var(--bad)", borderRadius: 12, background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{error}</div>;
  if (!summary) return <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "加载中…" : "Loading…"}</p>;

  const anyUnknown = summary.unknownCards.length > 0;
  const generation = summary.generation;
  const genBusy = generation?.status === "queued" || generation?.status === "parsing";
  const metrics = [
    { label: zh ? "已评分" : "SCORED", value: `${summary.scoredCount} / ${summary.totalCards}`, sub: anyUnknown ? (zh ? `${summary.unknownCards.length} 项仍为未知` : `${summary.unknownCards.length} remain Unknown`) : (zh ? "需求项" : "requirements") },
    { label: zh ? "必须项覆盖" : "MUST-HAVE COVERAGE", value: `${summary.mustHaveMet} / ${summary.mustHaveTotal}`, sub: zh ? "达到标准" : "meeting the bar" },
    { label: zh ? "已评估权重" : "EVALUATED WEIGHT", value: `${summary.evaluatedWeightPct}%`, sub: zh ? "占总评分标准" : "of total rubric" },
    { label: zh ? "总体结果" : "OVERALL SCORE", value: summary.overall == null ? "—" : summary.overall === "pass" ? (zh ? "通过" : "Pass") : (zh ? "未通过" : "Fail"), sub: summary.overall == null ? (zh ? "部分评估 — 见下方" : "partial — see below") : (zh ? "所有需求项已评分" : "all requirements scored") },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
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
            <b>{t.partialEvalPre}</b> {zh ? "只有所有评分项都完成评分后，才会显示最终加权分。" : "A final weighted score only appears once every rubric item is scored."}{" "}
            {zh ? `下方 ${summary.unknownCards.length} 项为"未知"而非 0 分：` : `${summary.unknownCards.length} item(s) below are Unknown, not zero: `}
            {summary.unknownCards.map((c) => c.requirement).join("、")}。
          </div>
        </div>
      )}

      {summary.mismatches.length > 0 && (
        <div style={{ padding: "12px 15px", border: "1px solid var(--ai)", borderRadius: 12, background: "var(--ai-soft)" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.aiVsHumanPre}{summary.mismatches.length}{t.aiVsHumanMid}</div>
          {summary.mismatches.map((m) => (
            <div key={m.cardId} style={{ marginTop: 5, fontSize: 12.5, color: "var(--ink-2)" }}>
              {m.requirement}{t.aiVsHumanLine}{m.ai}{t.aiVsHumanLine2}{m.human}.{" "}
              <button onClick={() => showTrace(m.cardId)} style={{ border: 0, background: "transparent", padding: 0, color: "var(--ink)", textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}>{t.seeBothTraces}</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: "var(--ink-3)" }}>
        <span>
          {genBusy ? (zh ? "AI 正在根据所有轮次的转写逐项生成草稿分…" : "AI is drafting per-card scores from every round's transcript…")
            : generation?.status === "failed" ? <span style={{ color: "var(--bad)" }}>{zh ? `AI 草稿生成失败：${generation.errorCode}` : `AI draft failed: ${generation.errorCode}`}</span>
            : generation ? (zh ? "展开任一项可对照人工记录与 AI 跨轮草稿。AI 草稿不计入上方结果。" : "Expand any item to compare the recorded score with the AI cross-round draft. AI drafts never count toward the result above.")
            : (zh ? "还没有 AI 跨轮草稿。" : "No AI cross-round draft yet.")}
        </span>
        {draftError && <span role="alert" style={{ color: "var(--bad)" }}>{draftError}</span>}
        <div style={{ flex: 1 }} />
        <button disabled={drafting || genBusy} onClick={() => void regenerate()}
          style={{ height: 26, padding: "0 10px", border: "1px solid var(--ai)", borderRadius: 7, background: "var(--surface)", color: "var(--ai)", fontSize: 11, cursor: drafting || genBusy ? "not-allowed" : "pointer" }}>
          {genBusy ? (zh ? "生成中…" : "Generating…") : generation ? (zh ? "重新生成 AI 草稿" : "Regenerate AI draft") : (zh ? "生成 AI 草稿" : "Generate AI draft")}
        </button>
      </div>

      {summary.cards.map((c) => <DebriefRow key={c.id} card={c} bar={summary.bar} open={openCards.has(c.id)} onToggle={() => toggle(c.id)} zh={zh} />)}

      {summary.unresolved.length > 0 && (
        <div style={panel}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: ".05em", color: "var(--ink-3)" }}>{zh ? "重大未解决问题（AI 草稿）" : "MAJOR OPEN ISSUES (AI DRAFT)"}</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>
            {summary.unresolved.map((q, i) => <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55 }}>{q}</li>)}
          </ul>
        </div>
      )}

      {!isDone("debrief") && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-2)", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }} />
          <button onClick={() => set({ screen: "review" })} style={{ height: 34, padding: "0 12px", border: "1px solid transparent", borderRadius: 11, background: "transparent", color: "var(--ink-2)", fontSize: 12.5, cursor: "pointer" }}>{t.backToReview}</button>
          {startError && <span role="alert" style={{ fontSize: 11.5, color: "var(--bad)" }}>{startError}</span>}
          <button disabled={starting} onClick={() => void continueToDecision()} style={{ height: 34, padding: "0 15px", border: "1px solid var(--brand)", borderRadius: 11, background: "var(--brand)", color: "var(--brand-ink)", fontSize: 12.5, fontWeight: 600, cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.6 : 1 }}>{starting ? (zh ? "正在准备决定…" : "Preparing decision…") : t.continueToDecision}</button>
        </div>
      )}
    </>
  );
}
