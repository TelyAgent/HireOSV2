import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Pill, type Tone } from "../../utils/status";
import { api, type PackageState, type Decision } from "../../features/project-intake/api";

const card = { padding: "15px 17px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" } as const;
const eyebrow = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: ".05em", color: "var(--ink-3)" } as const;
const btn = { height: 30, padding: "0 12px", border: "1px solid var(--line-strong)", borderRadius: 8, background: "var(--surface)", fontSize: 12, cursor: "pointer" } as const;
const statusPill = { marginTop: 9, display: "inline-flex", alignItems: "center", height: 26, padding: "0 10px", borderRadius: 7, background: "var(--surface-2)", fontSize: 12, color: "var(--ink-2)" } as const;

const EVIDENCE_TONE: Record<PackageState["evidence"][number]["tag"], Tone> = {
  strong: "ok", medium: "warn", weak: "bad", unknown: "unknown",
};
const evidenceLabel = (tag: PackageState["evidence"][number]["tag"], zh: boolean) => ({
  strong: zh ? "有力证据" : "Strong evidence",
  medium: zh ? "一般证据" : "Medium evidence",
  weak: zh ? "薄弱证据" : "Weak evidence",
  unknown: zh ? "尚无证据" : "No evidence",
}[tag]);
const DECISION_LABEL: Record<Decision, { en: string; zh: string }> = {
  continue_next_round: { en: "Continue to next round", zh: "进入下一轮" },
  hold: { en: "Hold", zh: "暂缓" },
  request_more_evidence: { en: "Request more evidence", zh: "补充证据" },
  do_not_proceed: { en: "Do not proceed", zh: "不推进" },
  recommend_offer: { en: "Recommend for offer", zh: "推荐发放 Offer" },
};

export function PackagePage() {
  const { state, set, say, t } = useStore();
  const zh = state.lang === "zh";
  const taskId = state.currentTaskId;
  const [data, setData] = useState<PackageState | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<"hr" | "hm" | null>(null);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!taskId) { setData(null); return; }
    let active = true; setError("");
    api<PackageState>(`/tasks/${taskId}/package`)
      .then((value) => { if (active) setData(value); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "REQUEST_FAILED"); });
    return () => { active = false; };
  }, [taskId]);

  const toggleConfirm = async (role: "hr" | "hm") => {
    if (!taskId || !data) return;
    const confirmed = role === "hr" ? !data.hrConfirmedAt : !data.hmConfirmedAt;
    setConfirming(role); setActionError("");
    try { setData(await api<PackageState>(`/tasks/${taskId}/package/confirm`, { method: "PATCH", body: JSON.stringify({ role, confirmed }) })); }
    catch (e) { setActionError(e instanceof Error ? e.message : "REQUEST_FAILED"); }
    finally { setConfirming(null); }
  };

  const sendOffer = async () => {
    if (!taskId) return;
    setSendingOffer(true); setActionError("");
    try { setData(await api<PackageState>(`/tasks/${taskId}/package/offer`, { method: "POST" })); }
    catch (e) {
      const code = e instanceof Error ? e.message : "REQUEST_FAILED";
      setActionError(code === "DECISION_NOT_RECOMMEND_OFFER" ? (zh ? "当前决定不是「推荐发放 Offer」，无法发送。" : "The recorded decision isn't \"Recommend for offer\" — can't send.")
        : code === "PACKAGE_NOT_CONFIRMED" ? (zh ? "需要 HR 和招聘经理都确认后才能发送。" : "Both HR and Hiring Manager must confirm first.")
        : code === "ALREADY_SENT" ? (zh ? "已经发送过了。" : "Already sent.")
        : code);
    } finally { setSendingOffer(false); }
  };

  if (!taskId) return <div style={{ ...card, fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "未关联真实面试任务。" : "No real task linked."}</div>;
  if (!data) return error
    ? <div role="alert" style={{ ...card, borderColor: "var(--bad)", background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12.5 }}>{error}</div>
    : <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "加载中…" : "Loading…"}</p>;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)" }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-3)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.hiringEvalPackage}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{data.candidateName} · {data.jobTitle} · {data.published ? (zh ? "已发布" : "Published") : (zh ? "审阅中" : "In review")}</div>
        </div>
        <button onClick={() => say("Export is simulated here. It would carry the rubric, scores, evidence links and both confirmations as one PDF.")} style={btn}>{t.exportPdf}</button>
      </div>

      {!data.published && (
        <div style={{ padding: "11px 14px", border: "1px solid var(--warn)", borderRadius: 12, background: "var(--warn-soft)", fontSize: 12.5 }}>
          ⏱ {zh ? "该评估包仍在审阅中——需要先记录决定，并由 HR 和招聘经理都确认后才能发布。" : "This package is still in review — a decision must be recorded, and both HR and Hiring Manager must confirm, before it can be published."}{" "}
          {!data.decision && (
            <a href="#" onClick={(e) => { e.preventDefault(); set({ screen: "decision" }); }} style={{ textDecoration: "underline" }}>{t.goToDecisionArrow}</a>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface)", overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", ...eyebrow }}>{t.evidenceManifestHeader}</div>
          {data.evidence.map((e) => (
            <div key={e.cardId} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55 }}>
                <div style={{ fontWeight: 600 }}>{e.requirement}</div>
                <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>
                  {(e.cardPriority === "P0" ? (zh ? "必须项" : "Must-have") : e.cardPriority)} · {zh ? "权重" : "Weight"} {e.weight}%{e.roundName ? ` · ${e.roundName}` : ""}
                </div>
                {e.note && <div style={{ marginTop: 6 }}>{zh ? "人工备注：" : "Note: "}{e.note}</div>}
                {e.aiRationale && <div style={{ marginTop: 4, color: "var(--ai)" }}>{zh ? "AI 依据：" : "AI rationale: "}{e.aiRationale}</div>}
              </div>
              <Pill label={evidenceLabel(e.tag, zh)} tone={EVIDENCE_TONE[e.tag]} />
            </div>
          ))}
          {!data.evidence.length && <div style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--ink-3)" }}>{zh ? "暂无可用证据。" : "No evidence available yet."}</div>}
          <div style={{ padding: "11px 16px", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.45 }}>{t.fullRecordingsNote}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: "14px 16px" }}>
            <div style={eyebrow}>{t.humanReviewHeader}</div>
            <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 10 }}>
              {(["hr", "hm"] as const).map((role) => {
                const confirmedAt = role === "hr" ? data.hrConfirmedAt : data.hmConfirmedAt;
                const label = role === "hr" ? t.hrLabel : t.hmLabel;
                return (
                  <div key={role} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5 }}>{label}</div>
                      {confirmedAt && <div style={{ fontSize: 11, color: "var(--ok)" }}>✓ {zh ? "已确认 · " : "Confirmed · "}{new Date(confirmedAt).toLocaleString(zh ? "zh-CN" : "en-US")}</div>}
                    </div>
                    <button disabled={confirming === role} onClick={() => void toggleConfirm(role)} style={{ ...btn, height: 28, cursor: confirming === role ? "not-allowed" : "pointer" }}>
                      {confirming === role ? "…" : confirmedAt ? (zh ? "取消确认" : "Unconfirm") : (zh ? "确认" : "Confirm")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...card, padding: "14px 16px" }}>
            <div style={eyebrow}>{t.recommendedNextAction}</div>
            <div style={{ ...statusPill, fontFamily: "'IBM Plex Mono', monospace" }}>
              {data.decision ? DECISION_LABEL[data.decision][zh ? "zh" : "en"] : (zh ? "尚无决定" : "No decision yet")}
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
              {zh ? "这表示「可推进至 Offer 审核」，并非批准发放 Offer。预算、编制与薪酬由 Offer 模块决定。" : `This means "ready for Offer's review," not an approval to send an Offer. Budget, headcount and compensation are decided in the Offer module.`}
            </div>
          </div>

          <div style={{ ...card, padding: "14px 16px" }}>
            <div style={eyebrow}>{t.offerHandoffStatus}</div>
            <div style={statusPill}>
              {data.offerState === "sent" ? `${zh ? "已发送" : "Sent"} · ${data.offerSentAt ? new Date(data.offerSentAt).toLocaleString(zh ? "zh-CN" : "en-US") : ""}` : (zh ? "未连接" : "Not connected")}
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button disabled={sendingOffer || data.offerState === "sent"} onClick={() => void sendOffer()} style={{ ...btn, cursor: sendingOffer || data.offerState === "sent" ? "not-allowed" : "pointer" }}>
                {data.offerState === "sent" ? (zh ? "已发送至 Offer" : "Sent to Offer") : sendingOffer ? (zh ? "发送中…" : "Sending…") : (zh ? "发送至 Offer" : "Send to Offer")}
              </button>
            </div>
            {actionError && <div role="alert" style={{ marginTop: 8, fontSize: 11.5, color: "var(--bad)" }}>{actionError}</div>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-2)", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }} />
        <button onClick={() => set({ screen: "decision" })} style={{ height: 34, padding: "0 12px", border: "1px solid transparent", borderRadius: 11, background: "transparent", color: "var(--ink-2)", fontSize: 12.5, cursor: "pointer" }}>{t.backToDecision}</button>
        <button onClick={() => set({ screen: "home" })} style={{ height: 34, padding: "0 15px", border: "1px solid var(--brand)", borderRadius: 11, background: "var(--brand)", color: "var(--brand-ink)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t.backToProjects}</button>
      </div>
    </>
  );
}
