import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, Tabs, Card } from "../components/ui/Primitives";
import { CASES, CORE_CANDIDATES, EVALUATIONS, RELEASES, REVISIONS } from "../data/fixtures";

type TabKey = "original" | "feedback" | "revised";

export function RevisionPage() {
  const { id: caseId = "", round = "1" } = useParams();
  const { t } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("original");

  const c = CASES[caseId];
  const cand = c ? CORE_CANDIDATES[c.candidateId] : null;
  const evaluation = EVALUATIONS[`eval_${caseId}`];
  const revision = REVISIONS[`${caseId}_r${round}`];
  const release = Object.values(RELEASES).find((r) => r.caseId === caseId);
  // No demo case has a revised submission yet — REVISIONS/evaluation.revisedCriteria
  // are always empty in the seed; this branch documents what the workspace would show
  // once a candidate's revised answers come back.
  const revisedCriteria = (evaluation as unknown as { revisedCriteria?: typeof evaluation.criteria })?.revisedCriteria;

  if (!c || !cand || !evaluation) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Assessments", href: "/assessments" }, { label: "Revision" }]} />
        <div className="banner danger" style={{ marginTop: 12 }}>{t("Case not found.")}</div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Assessments", href: "/assessments" }, { label: cand.name, href: `/results/${caseId}/release` }, { label: `${t("Revision")} ${round}` }]} />
      <h1 style={{ margin: "8px 0 4px" }}>{cand.name} — {t("Revision round")} {round}</h1>
      <div className="muted" style={{ marginBottom: 16 }}>
        {revision ? <StatusBadge status={revision.status} /> : t("Not yet accepted by candidate")}
      </div>

      {!revisedCriteria && (
        <div className="banner info" style={{ marginBottom: 16 }}>{t("Not comparable yet — no revised answers received. Original stays available below.")}</div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "original", label: "Original" },
          { value: "feedback", label: "Feedback" },
          { value: "revised", label: "Revised" },
        ]}
      />

      {tab === "original" && (
        <Card>
          {evaluation.criteria.map((cr) => (
            <div key={cr.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span>{cr.name}</span>
              <span>{cr.human}/{cr.max}</span>
            </div>
          ))}
        </Card>
      )}
      {tab === "feedback" && <Card>{release?.feedbackText ? release.feedbackText : "—"}</Card>}
      {tab === "revised" && (
        <Card>
          {!revisedCriteria ? (
            <div className="empty">{t("Not comparable — awaiting revised submission.")}</div>
          ) : (
            revisedCriteria.map((cr, i) => {
              const orig = evaluation.criteria[i];
              const delta = cr.ai - (orig.human ?? 0);
              return (
                <div key={cr.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{cr.name}</span>
                  <span>{orig.human} → {cr.ai}/{cr.max} <span className={`badge ${delta > 0 ? "success" : "neutral"}`}>{delta > 0 ? t("Improved") : t("No change")}</span></span>
                </div>
              );
            })
          )}
        </Card>
      )}

      {revisedCriteria && (
        <Button variant="primary" style={{ marginTop: 16 }} onClick={() => navigate(`/results/${caseId}/release`)}>{t("Approve revised scores")}</Button>
      )}
    </div>
  );
}
