import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Button, EmptyState } from "../components/ui/Primitives";
import { CASES, CORE_CANDIDATES, COMPARISONS, EVALUATIONS, RESULTS, type Criterion } from "../data/fixtures";

function computeOverall(criteria: Criterion[], key: "ai" | "human"): number | null {
  if (criteria.some((c) => c[key] == null)) return null;
  return Math.round(criteria.reduce((sum, c) => sum + (c[key] as number), 0));
}

function comparableCells(caseId: string) {
  const result = Object.values(RESULTS).find((r) => r.caseId === caseId);
  const evaluation = (result ? EVALUATIONS[result.evaluationId] : null) || EVALUATIONS[`eval_${caseId}`] || null;
  return { result, evaluation, isFinal: !!(evaluation && evaluation.status === "final") };
}

const MODES = [
  { key: "current_summary", label: "Current summary" },
  { key: "same_stage", label: "Same stage" },
  { key: "round_changes", label: "Changes since last round" },
];

export function ComparisonDetailPage() {
  const { id = "" } = useParams();
  const { t, say } = useStore();
  const navigate = useNavigate();
  const cmp = COMPARISONS[id];
  const [mode, setMode] = useState(cmp?.mode || "current_summary");
  const [onlyDiff, setOnlyDiff] = useState(false);

  const cells = (cmp?.caseIds || []).map((caseId) => ({
    caseId,
    cand: CORE_CANDIDATES[CASES[caseId].candidateId],
    ...comparableCells(caseId),
  }));
  const bothFinal = cells.every((c) => c.isFinal);
  const scores = cells.map((c) => (c.isFinal && c.result ? c.result.overall : c.evaluation ? computeOverall(c.evaluation.criteria, "ai") : null));

  const allCompNames = useMemo(
    () => Array.from(new Set(cells.flatMap((c) => (c.evaluation ? c.evaluation.criteria.map((x) => x.name) : [])))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  if (!cmp) return <EmptyState title="Comparison not found." />;

  const keyDifferences = allCompNames
    .map((name) => {
      const vals = cells.map((c) => {
        const cr = c.evaluation?.criteria.find((x) => x.name === name);
        return cr ? (c.isFinal ? cr.human : cr.ai) : null;
      });
      if (vals.every((v) => v == null)) return null;
      const known = vals.filter((v): v is number => v != null);
      if (Math.max(...known) - Math.min(...known) < 5) return null;
      return `${name}: ${cells.map((c, i) => `${c.cand.name} ${vals[i] == null ? t("Unknown") : vals[i]}`).join(" vs ")}`;
    })
    .filter((x): x is string => !!x);

  const rows = onlyDiff ? allCompNames.filter((name) => keyDifferences.some((d) => d.startsWith(name))) : allCompNames;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h1>{t("Compare")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" onClick={() => say("New snapshot created; previous version retained.")}>{t("Refresh")}</Button>
          <Button size="sm" onClick={() => say(`Single-page export simulated (light theme, ${cmp.caseIds.length} of ${cmp.caseIds.length} shown — no sending occurs).`)}>{t("Export")}</Button>
        </div>
      </div>

      <div className="flex gap-2" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {MODES.map((m) => (
          <Button key={m.key} size="sm" variant={mode === m.key ? "primary" : "default"} onClick={() => setMode(m.key)}>{t(m.label)}</Button>
        ))}
      </div>
      <div className="flex items-center gap-2" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <label className="checkbox-row" style={{ display: "flex" }}>
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> {t("Only show differences")}
        </label>
        <Button size="sm" variant="ghost" onClick={() => say("Comparison comment saved to this view (demo).", { type: "success" })}>Add comment</Button>
      </div>

      <div className={`banner ${bothFinal ? "info" : "warning"}`} style={{ marginBottom: 16 }}>
        {bothFinal ? t("Both results are final and directly comparable.") : t("One or more results are AI-draft, not final — shown for reference only. No clear overall leader can be claimed across different evaluation stages.")}
      </div>

      {keyDifferences.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8 }}>{t("Key differences")}</h4>
          {keyDifferences.map((line) => (
            <div key={line} className="tiny" style={{ padding: "4px 0" }}>{line}</div>
          ))}
        </div>
      )}

      <div className="cmatrix">
        <table>
          <thead>
            <tr>
              <th>{t("Dimension")}</th>
              {cells.map((c) => <th key={c.caseId}>{c.cand.name}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t("Overall")}</td>
              {cells.map((c, i) => (
                <td key={c.caseId}>
                  {scores[i] == null ? <span className="badge neutral">{t("Unknown")}</span> : scores[i]}
                  {!c.isFinal && <span className="badge warning" style={{ marginLeft: 6 }}>{t("AI draft")}</span>}
                </td>
              ))}
            </tr>
            {rows.map((name) => (
              <tr key={name}>
                <td>{name}</td>
                {cells.map((c) => {
                  const cr = c.evaluation?.criteria.find((x) => x.name === name);
                  if (!cr) return <td key={c.caseId}><span className="badge neutral">{t("Not provided")}</span></td>;
                  const v = c.isFinal ? cr.human : cr.ai;
                  return <td key={c.caseId}>{v}/{cr.max}</td>;
                })}
              </tr>
            ))}
            <tr>
              <td>{t("Next action")}</td>
              {cells.map((c) => (
                <td key={c.caseId}>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/results/${c.caseId}/release`)}>{t("Open →")}</Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
