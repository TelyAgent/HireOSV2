import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Breadcrumbs, Button } from "../components/ui/Primitives";
import { QUESTIONS, type Competency } from "../data/fixtures";

/** Publishing here is demo-local (component state), not a mutation of the shared QUESTIONS
 * fixture — there's no backend yet to persist it, and the fixture is a module-level
 * singleton every page reads, so mutating it in place would leak across pages/sessions. */
export function BuilderPage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const navigate = useNavigate();
  const zh = state.lang === "zh";

  const q = QUESTIONS[id];
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [comps, setComps] = useState<Competency[]>(q ? q.competencies.map((c) => ({ ...c })) : []);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "failed" | "ready">("idle");
  const aiTries = useRef(0);

  if (!q) return <div className="banner danger">{t("Question not found.")}</div>;

  const sum = comps.reduce((a, c) => a + c.fraction, 0);
  const sumOk = Math.abs(sum - 1) < 0.001;
  const canPublish = sumOk && q.status !== "concept";

  function updateFraction(i: number, pct: number) {
    setComps((prev) => prev.map((c, idx) => (idx === i ? { ...c, fraction: pct / 100 } : c)));
  }
  function removeComp(i: number) {
    setComps((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addComp() {
    setComps((prev) => [...prev, { name: t("New competency"), fraction: 0 }]);
  }
  function generateDraft() {
    setAiStatus("loading");
    setTimeout(() => {
      aiTries.current += 1;
      setAiStatus(aiTries.current === 1 ? "failed" : "ready");
    }, 900);
  }
  function publish() {
    say(`${q.code} published as v${q.version + 1}. Existing sent invitations are unaffected.`, { type: "success" });
    navigate(`/questions/${q.id}`);
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Question Bank", href: "/question-bank" }, { label: q.code, href: `/questions/${q.id}` }, { label: "Builder" }]} />
      <h1 style={{ marginBottom: 4 }}>{t("Builder —")} {q.title}</h1>
      <div className="muted" style={{ marginBottom: 16 }}>{t("Editing creates a new derived version. Sent invitations always keep the exact version they were sent with.")}</div>

      {q.status === "concept" && (
        <div className="banner warning" style={{ marginBottom: 16 }}>{t("Draft the assessment before inviting candidates. Prompt, materials and rubric are not yet defined for this concept.")}</div>
      )}

      <div className="two-col">
        <div className="flex-col gap-3" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card card-pad">
            <h4 style={{ marginBottom: 8 }}>{t("Sections")}</h4>
            <div className="nav-item active"><span className="ic">1</span>{t("Prompt & materials")}</div>
            <div className="nav-item"><span className="ic">2</span>{t("Deliverables")}</div>
            <div className="nav-item"><span className="ic">3</span>{t("Competency allocation")}</div>
            <div className="nav-item"><span className="ic">4</span>{t("Quality review")}</div>
          </div>
          <div className="card card-pad">
            <h4 style={{ marginBottom: 8 }}>{t("AI generate")}</h4>
            <div className="tiny" style={{ marginBottom: 8 }}>{t("Requirement → competency → evidence needed → blueprint → question → rubric.")}</div>
            <Button size="sm" style={{ width: "100%" }} disabled={aiStatus === "loading"} onClick={generateDraft}>{t("Generate draft rubric")}</Button>
            <div className="tiny" style={{ marginTop: 8 }}>
              {aiStatus === "loading" && t("Generating… (demo latency)")}
              {aiStatus === "failed" && (
                <>
                  <span style={{ color: "var(--danger)" }}>{t("Generation failed (simulated timeout).")}</span>{" "}
                  <a style={{ cursor: "pointer" }} onClick={generateDraft}>{t("Retry")}</a>
                </>
              )}
              {aiStatus === "ready" && (
                <span style={{ color: "var(--success)" }}>
                  {zh ? <>草稿已生成 — <b>标记为草稿</b>，发布前需要人工编辑。</> : <>Draft ready — <b>marked Draft</b>, human edit required before publish.</>}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-col gap-4" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card card-pad">
            <h4 style={{ marginBottom: 8 }}>{t("Prompt")}</h4>
            <div className="field">
              <textarea className="input" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </div>
          </div>

          <div className="card card-pad">
            <h4 style={{ marginBottom: 8 }}>{t("Competency allocation (criterion fraction)")}</h4>
            <div className="tiny" style={{ marginBottom: 12 }}>{t("Multi-competency questions split credit by criterion. Fractions must sum to exactly 100% — no double-scoring.")}</div>
            {comps.map((c, i) => (
              <div key={i} className="crit-row">
                <div style={{ flex: 1 }}><span className="chip">{c.name}</span></div>
                <input className="input" style={{ width: 90, height: 36 }} type="number" min={0} max={100} step={5} value={Math.round(c.fraction * 100)} onChange={(e) => updateFraction(i, parseFloat(e.target.value) || 0)} />
                <span className="tiny">%</span>
                <Button size="sm" variant="ghost" title={t("Remove")} onClick={() => removeComp(i)}>
                  <span className="material-icons-o" style={{ fontSize: 16 }}>close</span>
                </Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" style={{ marginTop: 8 }} onClick={addComp}>{t("+ Add competency")}</Button>
            <div className={`banner ${sumOk ? "success" : "danger"}`} style={{ marginTop: 12 }}>
              {sumOk ? (
                <><span className="material-icons-o" style={{ fontSize: 16, verticalAlign: "text-bottom" }}>check</span> {t("Fractions sum to 100%. Ready to publish.")}</>
              ) : zh ? (
                `各项占比之和为 ${Math.round(sum * 100)}% —— 发布前必须恰好等于 100%。请调整上方的行。`
              ) : (
                `Fractions sum to ${Math.round(sum * 100)}% — must equal exactly 100% before publish. Adjust the row(s) above.`
              )}
            </div>
          </div>

          <div className="card card-pad">
            <h4 style={{ marginBottom: 8 }}>{t("Publish preview")}</h4>
            <div className="tiny" style={{ marginBottom: 8 }}>
              {zh
                ? `内容包：题目 · ${q.materials.length} 份材料 · ${q.deliverables.length} 项交付物 · ${comps.length} 项能力。`
                : `Package: prompt · ${q.materials.length} material(s) · ${q.deliverables.length} deliverable(s) · ${comps.length} competenc${comps.length === 1 ? "y" : "ies"}.`}
            </div>
            {q.pendingFractionIssue && (
              <div className="tiny" style={{ marginBottom: 8 }}>{t("Quality review flagged: competency weights need redistribution before this can publish cleanly.")}</div>
            )}
            <Button variant="primary" disabled={!canPublish} onClick={publish}>{t("Save & publish new version")}</Button>
            <Button variant="ghost" style={{ marginLeft: 8 }} onClick={() => say(t("Draft saved. Saving is not the same as publishing."))}>{t("Save draft (not published)")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
