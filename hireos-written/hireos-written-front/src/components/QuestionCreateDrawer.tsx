import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { useStore } from "../store/StoreContext";
import { Button } from "./ui/Primitives";
import { CORE_JOBS, QUESTIONS, type Competency, type Question } from "../data/fixtures";
import { createBankQuestion, extractQuestionCompetencies, generateAiQuestion, updateBankQuestion } from "../data/writtenApi";
import { toBankQuestion } from "../data/realQuestionsMerge";

/**
 * The Question Bank's "Create question" side drawer. Unlike AssessmentQuestionDrawer (which adds a
 * question to one candidate's plan), this authors a reusable bank question: role tags decide which
 * jobs' plan drawers offer it as a preset (AssessmentQuestionDrawer filters on `roles` + "published").
 * The author only writes title / roles / content -- scoring competencies are derived by AI on create.
 * With `editing`, the same drawer edits an existing bank question; competencies are re-derived only
 * when the title or content actually changed.
 */
export function QuestionCreateDrawer({
  open, onClose, onCreated, editing,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (question: Question) => void;
  editing?: Question;
}) {
  const { t, say, state } = useStore();
  const zh = state.lang === "zh";

  const [title, setTitle] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState("");
  const [prompt, setPrompt] = useState("");
  // Competencies that came with an "AI generate" draft, valid only while the content is unchanged.
  const [generated, setGenerated] = useState<{ prompt: string; competencies: Competency[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setRoles(editing?.roles ?? []);
    setRoleInput("");
    setPrompt(editing?.prompt ?? "");
    setGenerated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const jobTitles = Array.from(new Set(Object.values(CORE_JOBS).map((j) => j.title))).sort();
  const busy = aiLoading || creating;

  function addRole(value: string) {
    const v = value.trim();
    if (v && !roles.includes(v)) setRoles([...roles, v]);
    setRoleInput("");
  }

  async function runGenerate() {
    if (!title.trim()) {
      say(t("Enter a title first."), { type: "danger" });
      return;
    }
    setAiLoading(true);
    try {
      const result = await generateAiQuestion({
        jobTitle: roles[0] ?? title.trim(),
        focusBrief: title.trim(),
        lang: zh ? "zh" : "en",
      });
      setPrompt(result.prompt);
      setGenerated({ prompt: result.prompt, competencies: result.competencies });
    } catch {
      say(t("AI generation failed. Please try again."), { type: "danger" });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCreate() {
    if (busy) return;
    if (!title.trim()) {
      say(t("Enter a title first."), { type: "danger" });
      return;
    }
    if (!prompt.trim()) {
      say(t("Enter the question content."), { type: "danger" });
      return;
    }
    const finalRoles = roleInput.trim() && !roles.includes(roleInput.trim()) ? [...roles, roleInput.trim()] : roles;

    setCreating(true);
    const contentChanged = !editing || editing.title !== title.trim() || editing.prompt !== prompt.trim();
    let competencies: Competency[] | undefined;
    try {
      competencies = !contentChanged
        ? undefined
        : generated && generated.prompt === prompt && generated.competencies.length
          ? generated.competencies
          : (await extractQuestionCompetencies({ title: title.trim(), prompt: prompt.trim(), roles: finalRoles, lang: zh ? "zh" : "en" })).competencies;
    } catch {
      say(t("Could not generate competencies. Please try again."), { type: "danger" });
      setCreating(false);
      return;
    }

    let question: Question;
    try {
      const saved = editing
        ? await updateBankQuestion(editing.id, contentChanged
          ? { title: title.trim(), prompt: prompt.trim(), roles: finalRoles, competencies }
          : { roles: finalRoles })
        : await createBankQuestion({
          title: title.trim(), prompt: prompt.trim(), roles: finalRoles, competencies: competencies!,
          language: zh ? "中文" : "English", author: state.currentUser,
        });
      question = toBankQuestion(saved);
    } catch {
      say(t("Could not save this question. Please try again."), { type: "danger" });
      setCreating(false);
      return;
    }
    setCreating(false);
    QUESTIONS[question.id] = question;
    onCreated(question);
    say(t(editing ? "Question updated." : "Question created."), { type: "success" });
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={t(editing ? "Edit question" : "Create question")}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={handleCreate} disabled={busy}>
            {creating ? t("Saving…") : t(editing ? "Save changes" : "Create question")}
          </Button>
        </div>
      }
    >
      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t("Title")}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Design a high-throughput sorting module")} />
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t("Role tags")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            list="question-create-roles"
            value={roleInput}
            placeholder={t("Type or pick a role, press Enter to add")}
            onChange={(e) => setRoleInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRole(roleInput); } }}
          />
          <Button size="sm" onClick={() => addRole(roleInput)}>{t("Add")}</Button>
        </div>
        <datalist id="question-create-roles">
          {jobTitles.map((j) => <option key={j} value={j} />)}
        </datalist>
        {roles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {roles.map((r) => (
              <span key={r} className="chip">
                {r}{" "}
                <button type="button" style={{ border: "none", background: "none", cursor: "pointer", padding: 0, color: "var(--text-tertiary)" }} onClick={() => setRoles(roles.filter((x) => x !== r))}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="tiny" style={{ marginTop: 6, color: "var(--text-tertiary)" }}>
          {t("Published questions are offered as presets when adding questions for candidates of these roles.")}
        </div>
      </div>

      <div className="field">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ margin: 0 }}>{t("Question content")}</label>
          <Button size="sm" variant="ghost" icon="auto_awesome" disabled={busy} onClick={runGenerate}>
            {aiLoading ? t("Generating…") : t("Generate with AI")}
          </Button>
        </div>
        <textarea className="input" rows={16} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("Write the question, or generate a draft from the title with AI.")} />
        <div className="tiny" style={{ marginTop: 6, color: "var(--text-tertiary)" }}>
          {t("Scoring competencies are generated automatically from the content when you save the question.")}
        </div>
      </div>
    </Drawer>
  );
}
