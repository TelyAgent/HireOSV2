import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Pill, toneBg, toneFg, type Tone } from "../../utils/status";
import { api, type CardScoreEntry, type Recommendation, type Round, type RoundScoresState } from "../../features/project-intake/api";
import { useRounds } from "../../features/project-intake/useRounds";

const REC_OPTIONS: { value: Recommendation; label: (t: ReturnType<typeof useStore>["t"]) => string; tone: Tone }[] = [
  { value: "strong_advance", label: (t) => t.recStrongAdvance, tone: "ok" },
  { value: "advance", label: (t) => t.recAdvance, tone: "ok" },
  { value: "hold", label: (t) => t.recHold, tone: "warn" },
  { value: "do_not_advance", label: (t) => t.recDoNotAdvance, tone: "bad" },
  { value: "request_info", label: (t) => t.recRequestInfo, tone: "warn" },
];

function ScoreCard({ roundId, entry, t, zh, onSaved }: { roundId: string; entry: CardScoreEntry; t: ReturnType<typeof useStore>["t"]; zh: boolean; onSaved: (score: number | null, note: string) => void }) {
  const [score, setScore] = useState(entry.score);
  const [note, setNote] = useState(entry.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setScore(entry.score); setNote(entry.note); }, [entry]);

  // Score and note are a draft until "Save" — a reviewer changing their mind mid-thought
  // shouldn't be writing half-formed judgments to the record on every click.
  const dirty = score !== entry.score || note !== entry.note;
  const save = async () => {
    setSaving(true); setError("");
    try {
      await api(`/rounds/${roundId}/scores/${entry.card.id}`, { method: "PATCH", body: JSON.stringify({ score, note }) });
      onSaved(score, note);
    } catch (e) { setError(e instanceof Error ? e.message : "REQUEST_FAILED"); }
    finally { setSaving(false); }
  };
  const must = entry.card.cardPriority === "P0";
  const tone: Tone = score == null ? "unknown" : must && score < 3 ? "bad" : "ok";
  const mismatch = score != null && entry.aiScore != null && Math.abs(score - entry.aiScore) >= 2;
  const hasAi = entry.aiScore != null || !!entry.aiRationale;

  return (
    <div style={{ padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Pill label={must ? (zh ? "必须项" : "Must-have") : entry.card.cardPriority} tone={must ? "bad" : "unknown"} />
        <div style={{ flex: 1, minWidth: 160, fontSize: 14, fontWeight: 600 }}>{entry.card.requirement}</div>
        {mismatch && <Pill label={zh ? "⚠ 人工 / AI 评分差异较大" : "⚠ AI vs human differ"} tone="warn" />}
        <Pill label={tone === "unknown" ? (zh ? "未知" : "Unknown") : tone === "bad" ? (zh ? "未达标" : "Below bar") : (zh ? "已达标" : "Meets bar")} tone={tone} />
        <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{zh ? `权重 ${entry.card.weight}%` : `${entry.card.weight}% weight`}</div>
      </div>

      {hasAi && (
        <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--ai)", borderRadius: 9, background: "var(--ai-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: "var(--ai)" }}>{zh ? "AI 评分" : "AI SCORE"}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ai)" }}>{entry.aiScore ?? (zh ? "证据不足" : "Insufficient evidence")}</span>
            {entry.aiScore != null && (
              <button disabled={saving} onClick={() => { setScore(entry.aiScore); setNote(entry.aiRationale || ""); }}
                style={{ marginLeft: "auto", height: 24, padding: "0 9px", border: "1px solid var(--ai)", borderRadius: 7, background: "var(--surface)", color: "var(--ai)", fontSize: 11, cursor: saving ? "not-allowed" : "pointer" }}>
                {zh ? "采用此分" : "Adopt"}
              </button>
            )}
          </div>
          {entry.aiRationale && <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5, color: "var(--ink-2)" }}>{entry.aiRationale}</div>}
          {entry.aiQuote && <div style={{ marginTop: 5, fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-3)", fontStyle: "italic" }}>&ldquo;{entry.aiQuote}&rdquo;</div>}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: "var(--ink-3)" }}>{t.scoreEntryLabel}</div>
        <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((lvl) => {
            const active = score === lvl;
            return (
              <button key={lvl} disabled={saving} onClick={() => setScore(lvl)}
                style={{ width: 27, height: 27, borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                  border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`, background: active ? "var(--brand)" : "var(--surface)", color: active ? "var(--brand-ink)" : "var(--ink-2)" }}>
                {lvl}
              </button>
            );
          })}
          <button disabled={saving} onClick={() => setScore(null)}
            style={{ height: 27, padding: "0 9px", border: "1px solid var(--line)", borderRadius: 7, background: score === null ? "var(--surface-3)" : "transparent", color: "var(--ink-3)", fontSize: 11, cursor: saving ? "not-allowed" : "pointer" }}>
            {t.markUnknownLabel}
          </button>
        </div>
        <textarea value={note} disabled={saving} onChange={(e) => setNote(e.target.value)} placeholder={t.scoreNotePlaceholder}
          style={{ marginTop: 9, width: "100%", height: 64, border: "1px solid var(--line-strong)", borderRadius: 9, padding: "8px 10px", fontSize: 12, lineHeight: 1.5, color: "var(--ink)", background: "var(--surface)", resize: "vertical" }} />
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <button disabled={!dirty || saving} onClick={() => void save()}
            style={{ height: 30, padding: "0 14px", border: `1px solid ${dirty ? "var(--brand)" : "var(--line)"}`, borderRadius: 9, background: dirty ? "var(--brand)" : "var(--surface-2)", color: dirty ? "var(--brand-ink)" : "var(--ink-3)", fontSize: 12, fontWeight: 600, cursor: !dirty || saving ? "not-allowed" : "pointer" }}>
            {saving ? (zh ? "保存中…" : "Saving…") : (zh ? "保存评分" : "Save score")}
          </button>
          {dirty && !saving && <span style={{ fontSize: 11.5, color: "var(--warn)" }}>{zh ? "有未保存的修改" : "Unsaved changes"}</span>}
          {!dirty && !saving && (entry.score != null || entry.note) && <span style={{ fontSize: 11.5, color: "var(--ok)" }}>{zh ? "已保存" : "Saved"}</span>}
          {dirty && <button disabled={saving} onClick={() => { setScore(entry.score); setNote(entry.note); }}
            style={{ height: 30, padding: "0 10px", border: 0, background: "transparent", color: "var(--ink-3)", fontSize: 11.5, cursor: saving ? "not-allowed" : "pointer" }}>
            {zh ? "撤销修改" : "Discard"}
          </button>}
        </div>
        {error && <div role="alert" style={{ marginTop: 6, fontSize: 11.5, color: "var(--bad)" }}>{error}</div>}
      </div>
    </div>
  );
}

export function ReviewPage() {
  const { state, set, t } = useStore();
  const zh = state.lang === "zh";
  const { rounds, loading: roundsLoading } = useRounds(state.currentTaskId);
  const round: Round | null = rounds.find((r) => r.sequence === (state.roundView === "r2" ? 2 : 1)) ?? null;
  const started = round?.status === "completed";
  // Debrief rolls up every round's scores into one weighted result — fetching it before
  // every round is actually done would just show a permanently "partial" picture, so the
  // button (and the fetch behind it) stays locked until there is something real to roll up.
  const allRoundsDone = !roundsLoading && rounds.length > 0 && rounds.every((r) => r.status === "completed");
  const [entries, setEntries] = useState<CardScoreEntry[] | null>(null);
  const [generation, setGeneration] = useState<RoundScoresState["generation"]>(null);
  const [loadError, setLoadError] = useState("");
  const [recommendation, setRecommendationState] = useState<Recommendation | null>(null);
  const [recSaving, setRecSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState("");
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => { setRecommendationState(round?.recommendation ?? null); }, [round?.id, round?.recommendation]);

  useEffect(() => {
    if (!round || !started) { setEntries(null); setGeneration(null); return; }
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    setLoadError("");
    const poll = async () => {
      try {
        const value = await api<RoundScoresState>(`/rounds/${round.id}/scores`);
        if (stopped) return;
        setEntries(value.entries); setGeneration(value.generation);
        if (value.generation && (value.generation.status === "queued" || value.generation.status === "parsing")) timer = setTimeout(poll, 3000);
      } catch (e) { if (!stopped) setLoadError(e instanceof Error ? e.message : "REQUEST_FAILED"); }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [round?.id, started, pollKey]);

  const setRecommendation = async (value: Recommendation) => {
    if (!round) return;
    const next = recommendation === value ? null : value;
    setRecSaving(true);
    try {
      await api(`/rounds/${round.id}/recommendation`, { method: "PATCH", body: JSON.stringify({ recommendation: next }) });
      setRecommendationState(next);
    } finally { setRecSaving(false); }
  };

  const generateAiScores = async () => {
    if (!round) return;
    setTriggering(true); setTriggerError("");
    try {
      await api(`/rounds/${round.id}/ai-scores`, { method: "POST" });
      setPollKey((k) => k + 1);
    } catch (e) {
      const code = e instanceof Error ? e.message : "REQUEST_FAILED";
      setTriggerError(code === "NO_TRANSCRIPT" ? (zh ? "本轮还没有真实转写，无法生成 AI 评分。" : "No real transcript yet for this round — can't generate AI scores.")
        : code === "NO_CONFIRMED_RUBRIC" ? (zh ? "该职位尚无已确认的评分标准。" : "No confirmed rubric for this role yet.")
        : code);
    } finally { setTriggering(false); }
  };

  const genBusy = generation?.status === "queued" || generation?.status === "parsing";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 2, border: "1px solid var(--line)", borderRadius: 9, padding: 2 }}>
          <button onClick={() => set({ roundView: "r1" })} style={{ height: 26, padding: "0 10px", border: 0, borderRadius: 7, background: state.roundView === "r1" ? "var(--brand)" : "transparent", color: state.roundView === "r1" ? "var(--brand-ink)" : "var(--ink-2)", fontSize: 11.5, cursor: "pointer" }}>{t.round1}</button>
          <button onClick={() => set({ roundView: "r2" })} style={{ height: 26, padding: "0 10px", border: 0, borderRadius: 7, background: state.roundView === "r2" ? "var(--brand)" : "transparent", color: state.roundView === "r2" ? "var(--brand-ink)" : "var(--ink-2)", fontSize: 11.5, cursor: "pointer" }}>{t.round2}</button>
        </div>
        <div style={{ flex: 1 }} />
        {started && (
          <button disabled={triggering || genBusy} onClick={() => void generateAiScores()}
            style={{ height: 28, padding: "0 12px", border: "1px solid var(--ai)", borderRadius: 8, background: "var(--surface)", color: "var(--ai)", fontSize: 11.5, fontWeight: 600, cursor: triggering || genBusy ? "not-allowed" : "pointer" }}>
            {genBusy ? (zh ? "AI 评分生成中…" : "Generating AI scores…") : entries?.some((e) => e.aiScore != null || e.aiRationale) ? (zh ? "重新生成 AI 评分" : "Regenerate AI scores") : (zh ? "生成 AI 评分" : "Generate AI scores")}
          </button>
        )}
        <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
          {t.roundEvaluatorLabel}{round?.interviewer?.name ?? (zh ? "未指定" : "Unassigned")}
          {round?.completedAt && <>{t.submittedLabel}{new Date(round.completedAt).toLocaleDateString(zh ? "zh-CN" : "en-US")}</>}
        </div>
      </div>

      {!round && <div style={{ padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "未关联真实轮次。" : "No real round linked."}</div>}
      {round && !started && <div style={{ padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "本轮面试尚未完成，暂无可评审内容。在 Live Interview 里点击「完成面试并评审」后，这里才会出现评分卡片。" : "This round hasn't been completed yet — nothing to review. Score cards appear here once you click “Complete session & review” on Live Interview."}</div>}
      {loadError && <div role="alert" style={{ padding: "12px 15px", border: "1px solid var(--bad)", borderRadius: 12, background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{loadError}</div>}
      {triggerError && <div role="alert" style={{ padding: "12px 15px", border: "1px solid var(--bad)", borderRadius: 12, background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{triggerError}</div>}
      {generation?.status === "failed" && <div role="alert" style={{ padding: "12px 15px", border: "1px solid var(--bad)", borderRadius: 12, background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{zh ? `AI 评分生成失败：${generation.errorCode}` : `AI score generation failed: ${generation.errorCode}`}</div>}

      {round && started && (
        <div style={{ padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: ".05em", color: "var(--ink-3)" }}>{t.roundRecommendationLabel}</div>
          <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{t.roundRecommendationHint}</div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {REC_OPTIONS.map((opt) => {
              const active = recommendation === opt.value;
              return (
                <button key={opt.value} disabled={recSaving} onClick={() => void setRecommendation(opt.value)}
                  style={{ height: 32, padding: "0 13px", border: `1px solid ${active ? toneFg[opt.tone] : "var(--line)"}`, borderRadius: 9, background: active ? toneBg[opt.tone] : "var(--surface)", color: active ? toneFg[opt.tone] : "var(--ink-2)", fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: recSaving ? "not-allowed" : "pointer" }}>
                  {opt.label(t)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {entries?.map((entry) => (
        <ScoreCard key={entry.card.id} roundId={round!.id} entry={entry} t={t} zh={zh}
          onSaved={(score, note) => setEntries((previous) => previous?.map((e) => (e.card.id === entry.card.id ? { ...e, score, note } : e)) ?? previous)} />
      ))}
      {round && started && entries?.length === 0 && <div style={{ padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "该职位尚无已确认的评分标准。" : "No confirmed rubric for this role yet."}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-2)", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }} />
        <button onClick={() => set({ screen: "live" })} style={{ height: 34, padding: "0 12px", border: "1px solid transparent", borderRadius: 11, background: "transparent", color: "var(--ink-2)", fontSize: 12.5, cursor: "pointer" }}>{t.backToRecord}</button>
        {allRoundsDone
          ? <button onClick={() => set({ screen: "debrief" })} style={{ height: 34, padding: "0 15px", border: "1px solid var(--brand)", borderRadius: 11, background: "var(--brand)", color: "var(--brand-ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t.continueToDebrief}</button>
          : <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{zh ? "所有轮次的面试都完成后，这里才会出现「继续到汇总评估」。" : "“Continue to debrief” appears here once every round is completed."}</span>}
      </div>
    </>
  );
}
