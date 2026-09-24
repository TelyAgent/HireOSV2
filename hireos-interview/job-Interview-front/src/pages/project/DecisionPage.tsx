import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Pill } from "../../utils/status";
import { api, type Decision, type DecisionState } from "../../features/project-intake/api";

const OPTIONS: { value: Decision; en: string; zh: string }[] = [
  { value: "continue_next_round", en: "Continue to next round", zh: "进入下一轮" },
  { value: "hold", en: "Hold", zh: "暂缓" },
  { value: "request_more_evidence", en: "Request more evidence", zh: "补充证据" },
  { value: "do_not_proceed", en: "Do not proceed", zh: "不推进" },
  { value: "recommend_offer", en: "Recommend for offer", zh: "推荐发放 Offer" },
];

const card = { padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" } as const;
const eyebrow = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: ".05em", color: "var(--ink-3)" } as const;

export function DecisionPage() {
  const { state, set, t } = useStore();
  const zh = state.lang === "zh";
  const taskId = state.currentTaskId;
  const [data, setData] = useState<DecisionState | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => {
    if (!taskId) { setData(null); return; }
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await api<DecisionState>(`/tasks/${taskId}/decision`);
        if (stopped) return;
        setData(value); setError("");
        if (value.generation && (value.generation.status === "queued" || value.generation.status === "parsing")) timer = setTimeout(poll, 3000);
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "REQUEST_FAILED"); }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [taskId, pollKey]);

  const choose = async (value: Decision) => {
    if (!taskId || !data) return;
    const next = data.decision === value ? null : value;
    setSaving(true);
    try { setData(await api<DecisionState>(`/tasks/${taskId}/decision`, { method: "PATCH", body: JSON.stringify({ decision: next }) })); }
    catch (e) { setError(e instanceof Error ? e.message : "REQUEST_FAILED"); }
    finally { setSaving(false); }
  };

  const regenerate = async () => {
    if (!taskId) return;
    setRegenerating(true); setError("");
    try { await api(`/tasks/${taskId}/decision-draft`, { method: "POST" }); setPollKey((k) => k + 1); }
    catch (e) { setError(e instanceof Error ? e.message : "REQUEST_FAILED"); }
    finally { setRegenerating(false); }
  };

  if (!taskId) return <div style={{ ...card, fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "未关联真实面试任务。" : "No real task linked."}</div>;
  if (!data) return error
    ? <div role="alert" style={{ ...card, borderColor: "var(--bad)", background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{error}</div>
    : <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "加载中…" : "Loading…"}</p>;

  const status = data.generation?.status;
  const generating = status === "queued" || status === "parsing";
  const suggested = OPTIONS.find((o) => o.value === data.suggestedDecision);

  return (
    <>
      {error && <div role="alert" style={{ padding: "12px 15px", border: "1px solid var(--bad)", borderRadius: 12, background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{error}</div>}

      <div style={card}>
        <div style={eyebrow}>{t.recommendedAction}</div>
        {suggested && <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--ink-3)" }}>{zh ? `AI 草案建议：${suggested.zh}（仅供参考，最终由人决定）` : `AI draft suggests: ${suggested.en} (a proposal — a person decides)`}</div>}
        <div style={{ marginTop: 10, display: "flex", gap: 9, flexWrap: "wrap" }}>
          {OPTIONS.map((o) => {
            const active = data.decision === o.value;
            const isSuggested = data.suggestedDecision === o.value;
            return (
              <button key={o.value} disabled={saving} onClick={() => void choose(o.value)}
                style={{ height: 32, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${active ? "var(--brand)" : isSuggested ? "var(--ai)" : "var(--line)"}`, borderRadius: 9, background: active ? "var(--ok-soft)" : "var(--surface)", color: active ? "var(--ink)" : "var(--ink-2)", fontSize: 12.5, fontWeight: active ? 600 : 500, cursor: saving ? "not-allowed" : "pointer" }}>
                {zh ? o.zh : o.en}
                {isSuggested && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ai)" }}>AI</span>}
              </button>
            );
          })}
        </div>
        {data.decision && data.decisionAt && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--ok)" }}>{zh ? `已记录决定 · ${new Date(data.decisionAt).toLocaleString("zh-CN")}` : `Decision recorded · ${new Date(data.decisionAt).toLocaleString("en-US")}`}</div>}
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ ...eyebrow, flex: 1 }}>{t.draftConclusionHeader}</div>
          {data.conclusion && !generating && <Pill label={zh ? "AI 草案" : "AI draft"} tone="unknown" />}
          {!generating && (
            <button disabled={regenerating} onClick={() => void regenerate()}
              style={{ height: 26, padding: "0 10px", border: "1px solid var(--ai)", borderRadius: 8, background: "var(--surface)", color: "var(--ai)", fontSize: 11.5, fontWeight: 600, cursor: regenerating ? "not-allowed" : "pointer" }}>
              {data.generation ? (zh ? "重新生成" : "Regenerate") : (zh ? "生成结论草案" : "Generate draft")}
            </button>
          )}
        </div>
        {generating && <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-3)" }}>{zh ? "AI 正在基于两轮评分生成结论草案…" : "AI is drafting the conclusion from the round scores…"}</div>}
        {status === "failed" && <div role="alert" style={{ marginTop: 10, fontSize: 12.5, color: "var(--bad)" }}>{zh ? `结论草案生成失败：${data.generation?.errorCode}` : `Draft generation failed: ${data.generation?.errorCode}`}</div>}
        {!generating && data.conclusion && <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{data.conclusion}</div>}
        {!generating && !data.conclusion && status !== "failed" && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "还没有结论草案。" : "No draft yet."}</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-2)", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }} />
        <button onClick={() => set({ screen: "debrief" })} style={{ height: 34, padding: "0 12px", border: "1px solid transparent", borderRadius: 11, background: "transparent", color: "var(--ink-2)", fontSize: 12.5, cursor: "pointer" }}>{t.backToDebrief}</button>
        {data.decision
          ? <button onClick={() => set({ screen: "package" })} style={{ height: 34, padding: "0 15px", border: "1px solid var(--brand)", borderRadius: 11, background: "var(--brand)", color: "var(--brand-ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{zh ? "前往评估包" : "Go to evaluation package"}</button>
          : <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{zh ? "记录决定后，这里才会出现「前往评估包」。" : "“Go to evaluation package” appears here once a decision is recorded."}</span>}
      </div>
    </>
  );
}
