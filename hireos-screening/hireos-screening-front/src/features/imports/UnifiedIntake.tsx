import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import { getUnifiedIntake, type UnifiedIntakeRow } from "../../data/api/imports";
import { getCandidate } from "../../data/db";
import { fmtDateTime } from "../../lib/format";

export function UnifiedIntake({ refreshKey }: { refreshKey: number }) {
  const { t, state } = useStore();
  const [rows, setRows] = useState<UnifiedIntakeRow[]>([]);

  useEffect(() => {
    getUnifiedIntake().then(setRows);
  }, [refreshKey]);

  return (
    <div className="section-block" style={{ marginTop: 24 }}>
      <div className="section-title">
        {t("Unified intake")} <span className="tiny" style={{ fontWeight: 400 }}>{t("— every channel, most recent first")}</span>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Time")}</th>
              <th>{t("File / item")}</th>
              <th>{t("Source")}</th>
              <th>{t("Candidate")}</th>
              <th>{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 14).map((r, i) => {
              const candidate = r.candidateId ? getCandidate(r.candidateId) : null;
              return (
                <tr key={i}>
                  <td className="tiny">{fmtDateTime(r.at, state.lang)}</td>
                  <td>{r.label}</td>
                  <td className="tiny">{r.source}</td>
                  <td>
                    {candidate ? (
                      <Link to={`/candidates/${candidate.id}`}>{candidate.displayName}</Link>
                    ) : r.candidateId && r.candidateName ? (
                      <Link to={`/candidates/${r.candidateId}`}>{r.candidateName}</Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{t(r.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
