import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { App as AntApp, Drawer, Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, Chip, Tabs } from "../components/ui/Primitives";
import { QUESTIONS } from "../data/fixtures";
import { QuestionCreateDrawer } from "../components/QuestionCreateDrawer";
import { deleteBankQuestion, listBankQuestionVersions, publishBankQuestion, deprecateBankQuestion, listQuestionDeprecations, type QuestionDeprecation, type BankQuestionVersion } from "../data/writtenApi";
import { toBankQuestion } from "../data/realQuestionsMerge";

type TabKey = "prompt" | "rubric" | "usage" | "versions";

export function QuestionDetailPage() {
  const { modal } = AntApp.useApp();
  const { id = "" } = useParams();
  const { t, state, set, say } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("prompt");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [deprecateOpen, setDeprecateOpen] = useState(false);
  const [deprecating, setDeprecating] = useState(false);
  const [deprecations, setDeprecations] = useState<QuestionDeprecation[]>([]);
  const [versions, setVersions] = useState<BankQuestionVersion[] | null>(null);
  const [versionsError, setVersionsError] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [versionReload, setVersionReload] = useState(0);
  useEffect(() => {
    let active = true;
    setVersions(null); setVersionsError(false); setSelectedVersion(null); setDeprecations([]);
    Promise.all([listBankQuestionVersions(id), listQuestionDeprecations(id)]).then(([rows, events]) => { if (active) { setVersions(rows); setSelectedVersion(rows[0]?.id ?? null); setDeprecations(events); } })
      .catch(() => { if (active) setVersionsError(true); });
    return () => { active = false; };
  }, [id, state.bankQuestionsVersion, versionReload]);

  const q = QUESTIONS[id];
  // bankQuestionsVersion stays 0 until App's first bank load lands -- on a hard reload of this URL,
  // "not found" before then would just be "not loaded yet".
  if (!q) return state.bankQuestionsVersion === 0
    ? <div className="muted">{t("Loading…")}</div>
    : <div className="banner danger">{t("Question not found.")}</div>;

  function confirmDelete() {
    modal.confirm({
      title: t("Delete question"),
      content: `${q.code} · ${q.title} — ${t("Candidates who were already given this question keep their copy.")}`,
      okText: t("Delete question"),
      okButtonProps: { danger: true },
      cancelText: t("Cancel"),
      onOk: async () => {
        try {
          await deleteBankQuestion(q.id);
          delete QUESTIONS[q.id];
          set({ bankQuestionsVersion: Date.now() });
          say(t("Question deleted."), { type: "success" });
          navigate("/question-bank");
        } catch {
          say(t("Could not delete this question. Please try again."), { type: "danger" });
        }
      },
    });
  }

  const zh = state.lang === "zh";
  const sum = q.competencies.reduce((a, c) => a + c.fraction, 0);
  const sumOk = Math.abs(sum - 1) < 0.001;
  const selected = versions?.find(v => v.id === selectedVersion);
  async function publish() {
        if (publishing) return;
        setPublishing(true);
        try {
          const result = await publishBankQuestion(q.id, q.revision!);
          QUESTIONS[q.id] = toBankQuestion(result.question);
          set({ bankQuestionsVersion: Date.now() });
          setPublishOpen(false);
          say(zh ? (result.replayed ? "该版本已发布，未重复创建。" : "题目版本已发布。") : (result.replayed ? "Version already published; no duplicate created." : "Question version published."), { type: "success" });
        } catch (error) {
          say(error instanceof Error ? error.message : (zh ? "发布失败，请重试。" : "Could not publish. Please retry."), { type: "danger" });
        } finally { setPublishing(false); }
  }

  async function deprecate() {
    if (deprecating) return;
    setDeprecating(true);
    try {
      const result = await deprecateBankQuestion(q.id, q.revision!);
      QUESTIONS[q.id] = toBankQuestion(result.question);
      set({ bankQuestionsVersion: Date.now() });
      setDeprecateOpen(false);
      setTab('versions');
      say(zh ? '题目已停用。' : 'Question deprecated.', { type: 'success' });
    } catch (error) {
      say(error instanceof Error ? error.message : (zh ? '停用失败，请重试。' : 'Could not deprecate. Please retry.'), { type: 'danger' });
    } finally { setDeprecating(false); }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Question Bank", href: "/question-bank" }, { label: q.code }]} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h1>{q.title}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {q.status === 'draft_review' && <Button size="sm" variant="primary" icon="publish" disabled={publishing || !sumOk || !q.revision} onClick={() => setPublishOpen(true)}>{zh ? "发布" : "Publish"}</Button>}
          {q.status === 'published' && <Button size="sm" disabled={deprecating || !q.revision} onClick={() => setDeprecateOpen(true)}>{zh ? '停用题目' : 'Deprecate question'}</Button>}
          <Button size="sm" onClick={() => setPreviewOpen(true)}>{t("Preview candidate view")}</Button>
          <Button size="sm" variant="danger" onClick={confirmDelete}>{t("Delete question")}</Button>
          <Button size="sm" variant="primary" onClick={() => setEditOpen(true)}>{t("Edit question")}</Button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <StatusBadge status={q.status} />
        <span className="tiny">
          {q.status === 'draft_review' ? (q.version === 0 ? (zh ? '草稿 · 尚未发布' : 'Draft · Not published') : (zh ? `草稿 · 最近发布 v${q.version}` : `Draft · Last published v${q.version}`)) : `v${q.version}`} · {q.type} · {q.language} · ~{q.estMinutes || "—"} min ·{" "}
          {q.usageCount == null || q.seenByCount == null
            ? t("Usage: Unknown")
            : zh ? `已使用 ${q.usageCount} 次 · ${q.seenByCount} 位候选人见过此版本` : `Used ${q.usageCount} times · ${q.seenByCount} candidates have seen this exact version`}
        </span>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "prompt", label: "Prompt" },
          { value: "rubric", label: "Rubric" },
          { value: "usage", label: "Usage" },
          { value: "versions", label: zh ? "版本" : "Versions" },
        ]}
      />

      {tab === 'versions' && <section aria-label={zh ? '题目版本' : 'Question versions'}>
        {versionsError ? <div role="alert">{zh ? '版本读取失败。' : 'Could not load versions.'} <Button onClick={() => setVersionReload(n => n + 1)}>{t('Retry')}</Button></div>
          : versions === null ? <p>{t('Loading…')}</p>
          : versions.length === 0 ? <p>{zh ? '尚无已发布版本。' : 'No published versions yet.'}</p>
          : <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {versions.map(v => <Button key={v.id} variant={selectedVersion === v.id ? 'primary' : 'ghost'} onClick={() => setSelectedVersion(v.id)}>{`v${v.version}`}{v.version === q.version ? (zh ? ' · 最近发布' : ' · Latest published') : (zh ? ' · 历史版本' : ' · Earlier revision')}</Button>)}
            </div>
            {selected && <div data-testid="question-version-content" style={{ overflowWrap: 'anywhere' }}>
              <h3>{selected.content.title}</h3>
              {deprecations.filter(event => event.version === selected.version).map(event => <p key={event.id} data-testid="question-deprecation" className="tiny">{zh ? '已停用' : 'Deprecated'} · v{event.version} · {event.actorId} · {new Date(event.createdAt).toLocaleString(zh ? 'zh-CN' : 'en-US')}</p>)}
              <p className="tiny">{selected.historicalBaseline ? (zh ? '迁移保留的现存内容；原发布信息未记录。' : 'Preserved existing content; original publication not recorded.') : `${selected.publishedBy ?? t('Unknown')} · ${selected.publishedAt ? new Date(selected.publishedAt).toLocaleString(zh ? 'zh-CN' : 'en-US') : t('Unknown')}`}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{selected.content.prompt}</p>
              <h4>{t('Rubric')}</h4>
              {selected.content.competencies.map(c => <p key={c.name}>{c.name} · {Math.round(c.fraction * 100)}%</p>)}
            </div>}
          </>}
      </section>}

      {tab === "prompt" && (
        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Prompt")}</h4>
          <p>{q.prompt}</p>
          <div className="divider" style={{ margin: "16px 0" }} />
          <h4 style={{ marginBottom: 8 }}>{t("Required deliverables")}</h4>
          {q.deliverables.length ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>{q.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
          ) : (
            <span className="muted">{t("None specified")}</span>
          )}
        </div>
      )}

      {tab === "rubric" && (
        <div className="card card-pad">
          <div className="banner warning" style={{ marginBottom: 12 }}>{t("Reviewer only — never shown to candidates.")}</div>
          {q.competencies.map((c) => (
            <div key={c.name} className="crit-row">
              <div style={{ flex: 1 }}><b>{c.name}</b></div>
              <Chip>{Math.round(c.fraction * 100)}% {t("of overall")}</Chip>
            </div>
          ))}
          <div className="tiny" style={{ marginTop: 8 }}>
            {zh
              ? `各项占比之和必须为 100%（不可重复计分）。当前总和：${Math.round(sum * 100)}%${sumOk ? " —— 无误。" : " —— 将阻止发布。"}`
              : `Fractions must sum to 100% (no double-counting). Current sum: ${Math.round(sum * 100)}%${sumOk ? " — OK." : " — will block publish."}`}
          </div>
          <div className="divider" style={{ margin: "16px 0" }} />
          {q.rubricNote && (
            <div className="tiny"><b>{t("Internal answer key")}</b> {t("(Reviewer only):")} {q.rubricNote}</div>
          )}
        </div>
      )}

      {tab === "usage" && (
        <div className="card card-pad">
          <div className="grid-3">
            <div className="metric"><div className="label">{t("Used in cases")}</div><div className="value">{q.usageCount ?? t("Unknown")}</div></div>
            <div className="metric"><div className="label">{t("Candidates who have seen this version")}</div><div className="value">{q.seenByCount ?? t("Unknown")}</div></div>
            <div className="metric"><div className="label">{t("Role mappings")}</div><div className="value">{q.roles.length}</div></div>
          </div>
          {(q.usageCount == null || q.seenByCount == null) && <p role="status" className="tiny" style={{ marginTop: 12 }}>{t("External usage records have not been retrieved. Unknown does not mean zero.")}</p>}
          <div className="tiny" style={{ marginTop: 12 }}>{t("Mapped roles:")} {q.roles.map((r) => <Chip key={r}>{r}</Chip>)}</div>
        </div>
      )}

      <QuestionCreateDrawer open={editOpen} onClose={() => setEditOpen(false)} editing={q} onCreated={() => set({ bankQuestionsVersion: Date.now() })} />

      <Modal open={publishOpen} title={zh ? '发布题目版本' : 'Publish question version'} okText={zh ? '发布' : 'Publish'} cancelText={t('Cancel')} confirmLoading={publishing} onOk={publish} onCancel={() => { if (!publishing) setPublishOpen(false); }}>
        {`${q.code} · ${q.title} · ${zh ? '草稿修订' : 'Draft revision'} ${q.revision}`}
      </Modal>

      <Modal open={deprecateOpen} title={zh ? '停用题目' : 'Deprecate question'} okText={zh ? '确认停用' : 'Confirm deprecation'} cancelText={t('Cancel')} confirmLoading={deprecating} onOk={deprecate} onCancel={() => { if (!deprecating) setDeprecateOpen(false); }}>
        <p>{q.code} · v{q.version} · {q.title}</p>
        <p>{zh ? '新计划将不能选用此题。已发送邀请保持不变。' : 'New plans cannot select this question. Existing invitations remain unchanged.'}</p>
      </Modal>

      <Drawer open={previewOpen} onClose={() => setPreviewOpen(false)} title={`${t("Candidate preview —")} ${q.code}`} width={520}>
        <div className="banner info" style={{ marginBottom: 12 }}>{t("This is exactly what the candidate will see — no rubric, internal notes, or answer key.")}</div>
        <h4 style={{ marginBottom: 8 }}>{q.title}</h4>
        <p style={{ marginBottom: 16 }}>{q.prompt}</p>
        <h4 style={{ marginBottom: 8 }}>{t("Materials")}</h4>
        {q.materials.length ? (
          <ul style={{ margin: "0 0 16px", paddingLeft: 20 }}>{q.materials.map((m) => <li key={m}>{m}</li>)}</ul>
        ) : (
          <div className="muted" style={{ marginBottom: 16 }}>{t("None")}</div>
        )}
        <h4 style={{ marginBottom: 8 }}>{t("What to submit")}</h4>
        {q.deliverables.length ? (
          <ul style={{ margin: 0, paddingLeft: 20 }}>{q.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
        ) : (
          <div className="muted">{t("None specified")}</div>
        )}
      </Drawer>
    </div>
  );
}
