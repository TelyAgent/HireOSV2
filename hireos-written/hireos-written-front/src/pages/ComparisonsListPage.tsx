import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Card, EmptyState } from "../components/ui/Primitives";
import { CASES, CORE_CANDIDATES, COMPARISONS, fmtDate } from "../data/fixtures";

export function ComparisonsListPage() {
  const { t } = useStore();
  const navigate = useNavigate();

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>{t("Comparisons")}</h1>
      {Object.keys(COMPARISONS).length === 0 && (
        <EmptyState icon="compare_arrows" title="No comparisons yet." sub="Start one from a role group on My Tasks once candidates have scores." />
      )}
      {Object.values(COMPARISONS).map((cmp) => (
        <Card key={cmp.id} style={{ cursor: "pointer", marginBottom: 8 }} className="clickable">
          <div onClick={() => navigate(`/comparisons/${cmp.id}`)}>
            <b>{cmp.caseIds.map((id) => CORE_CANDIDATES[CASES[id].candidateId].name).join(" vs ")}</b>
            <div className="tiny">{fmtDate(cmp.createdAt)} · {cmp.note}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}
