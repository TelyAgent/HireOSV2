import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Button, Chip } from "../components/ui/Primitives";
import { QuestionCreateDrawer } from "../components/QuestionCreateDrawer";
import { QUESTIONS, bankQuestions, type Question } from "../data/fixtures";
import { deleteBankQuestion, updateBankQuestion } from "../data/writtenApi";
import { loadBankQuestionsIntoFixtures } from "../data/realQuestionsMerge";

export function QuestionBankPage() {
  const { t, say, state, set } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [competency, setCompetency] = useState("all");
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Re-fetch the bank from the backend on every visit; QUESTIONS is a mutable module dict, so the
  // store's bankQuestionsVersion bump is what re-renders this page (and the memos below) afterwards.
  useEffect(() => {
    let cancelled = false;
    loadBankQuestionsIntoFixtures()
      .then(() => { if (!cancelled) set({ bankQuestionsVersion: Date.now() }); })
      .catch(() => { if (!cancelled) say(t("Could not load the question bank."), { type: "danger" }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => bankQuestions(), [state.bankQuestionsVersion]);

  async function toggleFavorite(qu: Question) {
    try {
      const saved = await updateBankQuestion(qu.id, { favorite: !qu.favorite });
      QUESTIONS[qu.id] = { ...qu, favorite: saved.favorite };
      set({ bankQuestionsVersion: Date.now() });
    } catch {
      say(t("Could not save this question. Please try again."), { type: "danger" });
    }
  }

  function confirmDelete(qu: Question) {
    Modal.confirm({
      title: t("Delete question"),
      content: `${qu.code} · ${qu.title} — ${t("Candidates who were already given this question keep their copy.")}`,
      okText: t("Delete question"),
      okButtonProps: { danger: true },
      cancelText: t("Cancel"),
      onOk: async () => {
        try {
          await deleteBankQuestion(qu.id);
          delete QUESTIONS[qu.id];
          set({ bankQuestionsVersion: Date.now() });
          say(t("Question deleted."), { type: "success" });
        } catch {
          say(t("Could not delete this question. Please try again."), { type: "danger" });
        }
      },
    });
  }
  const roles = useMemo(() => ["all", ...Array.from(new Set(questions.flatMap((qu) => qu.roles))).sort()], [questions]);
  const competencies = useMemo(() => ["all", ...Array.from(new Set(questions.flatMap((qu) => qu.competencies.map((c) => c.name)))).sort()], [questions]);

  const list = questions.filter((qu) => {
    if (role !== "all" && !qu.roles.includes(role)) return false;
    if (competency !== "all" && !qu.competencies.some((c) => c.name === competency)) return false;
    if (q && !(qu.title + " " + qu.code).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>{t("Question Bank")}</h1>
      <div className="muted" style={{ marginBottom: 16 }}>
        {t("Reusable questions, mapped to multiple roles and competencies. Publishing a case does not send it — invitations are a separate step.")}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ width: 260, height: 36 }} placeholder={t("Search title or code…")} value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" style={{ height: 36, width: "auto" }} value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r} value={r}>{r === "all" ? t("All roles") : r}</option>
            ))}
          </select>
          <select className="input" style={{ height: 36, width: "auto" }} value={competency} onChange={(e) => setCompetency(e.target.value)}>
            {competencies.map((c) => (
              <option key={c} value={c}>{c === "all" ? t("All competencies") : c}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" onClick={() => setImportOpen(true)}>{t("Import ZIP")}</Button>
          <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>{t("Create question")}</Button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>{t("Code")}</th>
              <th>{t("Title")}</th>
              <th>{t("Role tags")}</th>
              <th>{t("Competencies")}</th>
              <th>{t("Type")}</th>
              <th>{t("Difficulty")}</th>
              <th>{t("Version")}</th>
              <th>{t("Status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={10}><div className="empty">{t(loading && questions.length === 0 ? "Loading…" : questions.length === 0 ? "No questions yet." : "No questions match these filters.")}</div></td></tr>
            ) : (
              list.map((qu) => (
                <tr key={qu.id} className="clickable" onClick={() => navigate(`/questions/${qu.id}`)}>
                  <td onClick={(e) => { e.stopPropagation(); void toggleFavorite(qu); }} title={t(qu.favorite ? "Remove from favorites" : "Add to favorites")}>
                    <span className="material-icons-o" style={{ fontSize: 17, cursor: "pointer", color: qu.favorite ? "#F2B400" : "var(--text-secondary)" }}>
                      {qu.favorite ? "star" : "star_outline"}
                    </span>
                  </td>
                  <td className="mono">{qu.code}</td>
                  <td>{qu.title}</td>
                  <td>{qu.roles.map((r) => <Chip key={r}>{r.replace(" Analyst", "").replace(" Associate", "")}</Chip>)}</td>
                  <td>{qu.competencies.length ? qu.competencies.map((c) => <Chip key={c.name}>{c.name} {Math.round(c.fraction * 100)}%</Chip>) : "—"}</td>
                  <td>{t(qu.type)}</td>
                  <td>{t(qu.difficulty)}</td>
                  <td>v{qu.version}</td>
                  <td><StatusBadge status={qu.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => confirmDelete(qu)}>{t("Delete")}</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <QuestionCreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => set({ bankQuestionsVersion: Date.now() })} />

      <Modal
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        title={t("Import ZIP")}
        okText={t("Parse (demo)")}
        onOk={() => { setImportOpen(false); say("Parsed: 1 prompt · 2 materials · 1 internal answer key. Human confirmation required before publish."); }}
      >
        <div className="banner info" style={{ marginBottom: 12 }}>
          Demo adapter — no file is actually uploaded. Import separates <b>materials</b> from <b>internal answer keys</b> before anything is confirmed.
        </div>
        <div className="field">
          <label>{t("ZIP file")}</label>
          <input className="input" type="file" disabled />
        </div>
        <div className="tiny" style={{ marginTop: 8 }}>{t("On confirm, this demo will show a parsed preview: 1 prompt, 2 materials, 1 internal answer key. Old candidate submissions found inside a ZIP are never re-exported.")}</div>
      </Modal>
    </div>
  );
}
