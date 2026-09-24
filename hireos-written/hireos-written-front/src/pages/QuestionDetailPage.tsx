import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Drawer } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Badge, Breadcrumbs, Button, Chip, EmptyState, Tabs } from "../components/ui/Primitives";
import { QUESTIONS } from "../data/fixtures";
import { getUser } from "../data/users";
import type { UserId } from "../store/types";

type TabKey = "prompt" | "materials" | "rubric" | "usage" | "versions";

export function QuestionDetailPage() {
  const { id = "" } = useParams();
  const { t, state } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("prompt");
  const [previewOpen, setPreviewOpen] = useState(false);

  const q = QUESTIONS[id];
  if (!q) return <div className="banner danger">{t("Question not found.")}</div>;

  const zh = state.lang === "zh";
  const sum = q.competencies.reduce((a, c) => a + c.fraction, 0);
  const sumOk = Math.abs(sum - 1) < 0.001;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Question Bank", href: "/question-bank" }, { label: q.code }]} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h1>{q.title}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" onClick={() => setPreviewOpen(true)}>{t("Preview candidate view")}</Button>
          <Button size="sm" variant="primary" onClick={() => navigate(`/questions/${q.id}/builder`)}>{t("Edit / Builder")}</Button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <StatusBadge status={q.status} />
        <span className="tiny">
          v{q.version} · {q.type} · {q.language} · ~{q.estMinutes || "—"} min ·{" "}
          {zh ? `已使用 ${q.usageCount} 次 · ${q.seenByCount} 位候选人见过此版本` : `Used ${q.usageCount} times · ${q.seenByCount} candidates have seen this exact version`}
        </span>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "prompt", label: "Prompt" },
          { value: "materials", label: "Materials" },
          { value: "rubric", label: "Rubric" },
          { value: "usage", label: "Usage" },
          { value: "versions", label: "Versions" },
        ]}
      />

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

      {tab === "materials" && (
        <div className="card card-pad">
          {q.materials.length === 0 ? (
            <EmptyState title="No materials attached." />
          ) : (
            <>
              <h4 style={{ marginBottom: 8 }}>{t("Candidate-visible materials")}</h4>
              {q.materials.map((m) => (
                <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="material-icons-o" style={{ fontSize: 16, color: "var(--text-tertiary)" }}>attach_file</span>
                    {m}
                  </span>
                  <Button size="sm" variant="ghost">{t("Preview")}</Button>
                </div>
              ))}
            </>
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
            <div className="metric"><div className="label">{t("Used in cases")}</div><div className="value">{q.usageCount}</div></div>
            <div className="metric"><div className="label">{t("Candidates who have seen this version")}</div><div className="value">{q.seenByCount}</div></div>
            <div className="metric"><div className="label">{t("Role mappings")}</div><div className="value">{q.roles.length}</div></div>
          </div>
          <div className="tiny" style={{ marginTop: 12 }}>{t("Mapped roles:")} {q.roles.map((r) => <Chip key={r}>{r}</Chip>)}</div>
        </div>
      )}

      {tab === "versions" && (
        <div className="card card-pad">
          {Array.from({ length: q.version }, (_, i) => q.version - i).map((v) => (
            <div key={v} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div><b>v{v}</b> {v === q.version && <Badge tone="info">{t("Current")}</Badge>}</div>
              <div className="tiny">
                {v === q.version ? getUser(q.author as UserId)?.name || "—" : t("Earlier revision")} · {v === q.version ? t("Published") : t("Superseded")}
              </div>
            </div>
          ))}
        </div>
      )}

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
