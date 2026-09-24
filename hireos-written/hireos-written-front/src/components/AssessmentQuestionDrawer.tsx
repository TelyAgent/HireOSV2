import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { useStore } from "../store/StoreContext";
import { Button } from "./ui/Primitives";
import { Icon } from "./ui/Icon";
import { QUESTIONS, type Competency, type PlanItem, type Question } from "../data/fixtures";
import { fetchCaseAiContext, generateAiQuestion, type CaseAiContext } from "../data/writtenApi";

type Mode = "bank" | "ai";

export function AssessmentQuestionDrawer({
  open, onClose, caseId, jobTitle, editing, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  jobTitle: string;
  editing?: { planItem: PlanItem; question: Question };
  onConfirm: (result: { questionId: string; customPrompt: string | null; newQuestion?: Question }) => void;
}) {
  const { t, say, state } = useStore();
  const zh = state.lang === "zh";

  const [mode, setMode] = useState<Mode>("bank");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [focusBrief, setFocusBrief] = useState("");
  const [contentDraft, setContentDraft] = useState("");
  const [generated, setGenerated] = useState<{ competencies: Competency[]; deliverables: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [caseContext, setCaseContext] = useState<CaseAiContext | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setMode("bank");
      setSelectedQuestionId(editing.question.id);
      setContentDraft(editing.planItem.customPrompt ?? editing.question.prompt);
    } else {
      setMode("bank");
      setSelectedQuestionId("");
      setContentDraft("");
    }
    setFocusBrief("");
    setGenerated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.planItem.id]);

  useEffect(() => {
    // Real JD/resume text lives on the backend Case (only present for candidates that arrived via
    // a real screening handoff) — fetched once per drawer open so the AI call below can ground its
    // question in them. A missing case (fixture-only demo data) just means no extra context.
    if (!open || mode !== "ai") return;
    let cancelled = false;
    setCaseContext(null);
    fetchCaseAiContext(caseId)
      .then((ctx) => { if (!cancelled) setCaseContext(ctx); })
      .catch(() => { if (!cancelled) setCaseContext(null); });
    return () => {
      cancelled = true;
    };
  }, [open, mode, caseId]);

  const roleQuestions = Object.values(QUESTIONS).filter((q) => q.status === "published" && q.roles.includes(jobTitle));
  const roleCompetencyNames = Array.from(new Set(roleQuestions.flatMap((q) => q.competencies.map((cc) => cc.name))));
  const suggestionNames = roleCompetencyNames.length
    ? roleCompetencyNames.slice(0, 3)
    : [zh ? "任务理解与方案设计" : "Problem framing and solution design", zh ? "方法论正确性与严谨性" : "Methodological rigor and correctness", zh ? "结果呈现与沟通表达" : "Deliverable clarity and communication"];
  const suggestions = suggestionNames.map((name) => ({
    value: name,
    label: zh ? `重点测试候选人在「${name}」方面的实际判断与产出能力` : `Focus on the candidate's real-world judgment and output quality in "${name}"`,
  }));

  async function runGenerate(brief: string) {
    const trimmed = brief.trim();
    if (!trimmed) {
      setGenerated(null);
      setContentDraft("");
      return;
    }
    setAiLoading(true);
    try {
      const result = await generateAiQuestion({
        jobTitle,
        jdText: caseContext?.jdText ?? undefined,
        resumeText: caseContext?.resumeText ?? undefined,
        focusBrief: trimmed,
        lang: zh ? "zh" : "en",
      });
      setContentDraft(result.prompt);
      setGenerated({ competencies: result.competencies, deliverables: result.deliverables });
    } catch {
      say(t("AI generation failed. Please try again."), { type: "danger" });
    } finally {
      setAiLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setGenerated(null);
    setContentDraft("");
    setSelectedQuestionId("");
    setFocusBrief("");
  }

  function handleConfirm() {
    if (aiLoading) return;
    if (!contentDraft.trim()) {
      say(mode === "bank" ? t("Select a preset question first.") : t("Enter a test focus first."), { type: "danger" });
      return;
    }
    if (editing) {
      const questionId = mode === "bank" && selectedQuestionId ? selectedQuestionId : editing.question.id;
      const baseQuestion = QUESTIONS[questionId];
      const customPrompt = contentDraft !== baseQuestion.prompt ? contentDraft : null;
      onConfirm({ questionId, customPrompt });
      say(t("Question updated."), { type: "success" });
      onClose();
      return;
    }
    if (mode === "ai") {
      const qId = `q_ai_${caseId}_${Date.now()}`;
      const newQuestion: Question = {
        id: qId,
        code: `AI-${qId.slice(-4).toUpperCase()}`,
        title: `${zh ? "AI 生成 · " : "AI-generated · "}${focusBrief.trim().slice(0, 24)}`,
        type: "Written + File",
        roles: [jobTitle],
        competencies: generated?.competencies ?? [{ name: focusBrief.trim().slice(0, 20) || "Custom focus", fraction: 1 }],
        difficulty: "Medium",
        estMinutes: 120,
        language: zh ? "中文" : "English",
        version: 1,
        status: "published",
        author: state.currentUser,
        favorite: false,
        deliverables: generated?.deliverables ?? [zh ? "工作样本产出 (deliverable.md)" : "Work sample deliverable (deliverable.md)"],
        materials: [],
        usageCount: 0,
        seenByCount: 0,
        prompt: contentDraft,
      };
      QUESTIONS[qId] = newQuestion;
      const customPrompt = contentDraft !== newQuestion.prompt ? contentDraft : null;
      onConfirm({ questionId: qId, customPrompt, newQuestion });
      say(t("Written test question and scoring rubric generated."), { type: "success" });
      onClose();
      return;
    }
    if (!selectedQuestionId) {
      say(t("Select a preset question first."), { type: "danger" });
      return;
    }
    const baseQuestion = QUESTIONS[selectedQuestionId];
    const customPrompt = contentDraft !== baseQuestion.prompt ? contentDraft : null;
    onConfirm({ questionId: selectedQuestionId, customPrompt });
    say(t("Assessment question generated."), { type: "success" });
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={editing ? t("Edit question") : t("Generate assessment question")}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={aiLoading}>{editing ? t("Save changes") : t("Confirm generate")}</Button>
        </div>
      }
    >
      <div className="segmented-control" style={{ marginBottom: 16 }}>
        <button className={`btn sm ${mode === "bank" ? "primary" : "ghost"}`} onClick={() => switchMode("bank")}>
          <Icon name="list_alt" style={{ fontSize: 16 }} /> {t("From Question Bank")}
        </button>
        <button className={`btn sm ${mode === "ai" ? "primary ai-toggle" : "ghost ai-toggle"}`} onClick={() => switchMode("ai")}>
          <Icon name="auto_awesome" style={{ fontSize: 16 }} /> {t("AI-generated")}
        </button>
      </div>

      {mode === "bank" ? (
        <div style={{ marginBottom: 16 }}>
          <select
            className="input"
            value={selectedQuestionId}
            onChange={(e) => {
              const qId = e.target.value;
              setSelectedQuestionId(qId);
              if (qId) setContentDraft(QUESTIONS[qId].prompt);
            }}
          >
            <option value="">{t("— Select a preset question —")}</option>
            {roleQuestions.map((q) => (
              <option key={q.id} value={q.id}>{q.code} · {q.title}</option>
            ))}
          </select>
          <div className="tiny" style={{ marginTop: 8, color: "var(--text-tertiary)" }}>
            {t("Approved v1; edits below only apply to this candidate's draft and never change the role preset.")}
          </div>
        </div>
      ) : (
        <div className="ai-panel flex-col gap-3" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div className="field">
            <label>{t("Test focus")}</label>
            <textarea className="input" rows={2} placeholder={t("Tell me which capability you'd like to focus on testing.")} value={focusBrief} onChange={(e) => setFocusBrief(e.target.value)} />
          </div>
          <div className="tiny" style={{ fontWeight: 600, color: "var(--accent-700)" }}>{t("Based on this role's requirements, consider focusing on:")}</div>
          <div>
            {suggestions.map((s) => (
              <button key={s.value} type="button" className="ai-suggest-chip" disabled={aiLoading} onClick={() => runGenerate(s.value)}>{s.label}</button>
            ))}
          </div>
          <Button variant="primary" size="sm" icon="auto_awesome" disabled={aiLoading || !focusBrief.trim()} onClick={() => runGenerate(focusBrief)}>
            {aiLoading ? t("Generating…") : t("Generate with AI")}
          </Button>
          {caseContext === null && (
            <div className="tiny" style={{ color: "var(--text-tertiary)" }}>
              {t("No linked JD/resume text for this candidate yet — generating from the role title alone.")}
            </div>
          )}
        </div>
      )}

      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t("Question content")}</label>
        <textarea
          className="input"
          rows={14}
          placeholder={t("Select a preset question, or generate one with AI, to see its content here.")}
          value={contentDraft}
          onChange={(e) => setContentDraft(e.target.value)}
        />
      </div>

      {generated && (
        <div className="field">
          <label>{t("Scoring rubric")}</label>
          <div className="card card-pad tiny" style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
            {generated.competencies.map((cc) => (
              <div key={cc.name}>{cc.name} — {Math.round(cc.fraction * 100)}%</div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}
