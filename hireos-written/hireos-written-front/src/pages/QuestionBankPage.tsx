import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Button, Chip } from "../components/ui/Primitives";
import { QuestionCreateDrawer } from "../components/QuestionCreateDrawer";
import { QUESTIONS, bankQuestions, type Question } from "../data/fixtures";
import { deleteBankQuestion, updateBankQuestion } from "../data/writtenApi";
import { loadBankQuestionsIntoFixtures } from "../data/realQuestionsMerge";
import { bankRestore, bankSearch, readBankFilters, rememberBank, type BankFilters } from "../utils/bankReturn";

export function QuestionBankPage() {
  const { t, say, state, set } = useStore();
  const navigate = useNavigate();
  // Search, filters and the previewed question live in the URL and are restored on the way back (#369).
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const restore = bankRestore(location.search);
  useEffect(() => {
    if (restore !== null) setSearchParams(new URLSearchParams(restore), { replace: true });
  }, [restore, setSearchParams]);
  const filters = readBankFilters(restore !== null ? new URLSearchParams(restore) : searchParams);
  const { q, role, competency, selected } = filters;
  useEffect(() => {
    if (restore === null) rememberBank(location.search);
  }, [restore, location.search]);
  const update = (next: Partial<BankFilters>) => setSearchParams(new URLSearchParams(bankSearch({ ...filters, ...next })), { replace: true });
  const setQ = (value: string) => update({ q: value });
  const setRole = (value: string) => update({ role: value });
  const setCompetency = (value: string) => update({ competency: value });
  const filtered = q !== "" || role !== "all" || competency !== "all";
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

  const preview = selected ? questions.find((qu) => qu.id === selected) ?? null : null;
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
        {t("Reusable questions, mapped to multiple roles and competencies. Publishing a question doesn't send it to anyone — candidates get it only through an invitation, a separate step.")}
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
          {filtered && <Button size="sm" variant="ghost" onClick={() => update({ q: "", role: "all", competency: "all" })}>{t("Clear filters")}</Button>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" onClick={() => setImportOpen(true)}>{t("Import ZIP")}</Button>
          <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>{t("Create question")}</Button>
        </div>
      </div>

      <div className="bank-layout" style={{ display: "grid", gridTemplateColumns: preview ? "minmax(0, 1fr) minmax(280px, 380px)" : "minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>{t("Code")}</th>
              <th>{t("Title")}</th>
              {!preview && <th>{t("Role tags")}</th>}
              {!preview && <th>{t("Competencies")}</th>}
              {!preview && <th>{t("Type")}</th>}
              {!preview && <th>{t("Difficulty")}</th>}
              <th>{t("Version")}</th>
              <th>{t("Status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={preview ? 6 : 10}><div className="empty">{t(loading && questions.length === 0 ? "Loading…" : questions.length === 0 ? "No questions yet." : "No questions match these filters.")}</div></td></tr>
            ) : (
              list.map((qu) => (
                <tr
                  key={qu.id}
                  className={`clickable${qu.id === selected ? " selected" : ""}`}
                  aria-selected={qu.id === selected}
                  onClick={() => update({ selected: qu.id === selected ? "" : qu.id })}
                  onDoubleClick={() => navigate(`/questions/${qu.id}`)}
                >
                  <td onClick={(e) => { e.stopPropagation(); void toggleFavorite(qu); }} title={t(qu.favorite ? "Remove from favorites" : "Add to favorites")}>
                    <span className="material-icons-o" style={{ fontSize: 17, cursor: "pointer", color: qu.favorite ? "#F2B400" : "var(--text-secondary)" }}>
                      {qu.favorite ? "star" : "star_outline"}
                    </span>
                  </td>
                  <td className="mono">{qu.code}</td>
                  <td>{qu.title}</td>
                  {/* With a question previewed beside it, the list keeps only what tells rows apart; the rest is in the preview. */}
                  {!preview && <td>{qu.roles.map((r) => <Chip key={r}>{r.replace(" Analyst", "").replace(" Associate", "")}</Chip>)}</td>}
                  {!preview && <td>{qu.competencies.length ? qu.competencies.map((c) => <Chip key={c.name}>{c.name} {Math.round(c.fraction * 100)}%</Chip>) : "—"}</td>}
                  {!preview && <td>{t(qu.type)}</td>}
                  {!preview && <td>{t(qu.difficulty)}</td>}
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
      {preview && <QuestionPreview question={preview} onOpen={() => navigate(`/questions/${preview.id}`)} onClose={() => update({ selected: "" })} />}
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

/** The selected question beside the list (#369): read it without leaving the filtered results. Sending is not here. */
function QuestionPreview({ question, onOpen, onClose }: { question: Question; onOpen: () => void; onClose: () => void }) {
  const { t } = useStore();
  return (
    <aside className="card card-pad" aria-label={t("Question preview")} style={{ position: "sticky", top: 76, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div>
          <div className="mono tiny">{question.code} · v{question.version}</div>
          <div style={{ fontWeight: 600 }}>{question.title}</div>
        </div>
        <button type="button" className="icon-btn" aria-label={t("Close preview")} onClick={onClose}>
          <span className="material-icons-o" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <div><StatusBadge status={question.status} /></div>
      <div>{question.competencies.map((c) => <Chip key={c.name}>{c.name} {Math.round(c.fraction * 100)}%</Chip>)}</div>
      <div className="tiny" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, maxHeight: "50vh", overflow: "auto", color: "var(--text-secondary)" }}>{question.prompt}</div>
      <Button size="sm" variant="primary" onClick={onOpen}>{t("Open details")}</Button>
    </aside>
  );
}
