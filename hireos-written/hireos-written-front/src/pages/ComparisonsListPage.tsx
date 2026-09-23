import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Button, Card } from "../components/ui/Primitives";
import { CASES, CORE_CANDIDATES, COMPARISONS, fmtDate } from "../data/fixtures";

export function ComparisonsListPage() {
  const { t } = useStore();
  const navigate = useNavigate();

  return (
    <div>
      <h1 style={{ marginBottom: 16 }}>{t("Comparisons")}</h1>
      {Object.values(COMPARISONS).map((cmp) => (
        <Card key={cmp.id} style={{ cursor: "pointer", marginBottom: 8 }} className="clickable">
          <div onClick={() => navigate(`/comparisons/${cmp.id}`)}>
            <b>{cmp.caseIds.map((id) => CORE_CANDIDATES[CASES[id].candidateId].name).join(" vs ")}</b>
            <div className="tiny">{fmtDate(cmp.createdAt)} · {cmp.note}</div>
          </div>
        </Card>
      ))}
      <Button variant="primary" style={{ marginTop: 8 }} onClick={() => navigate("/comparisons/cmp_1")}>{t("New comparison")}</Button>
    </div>
  );
}
