import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Button, EmptyState } from "../components/ui/Primitives";

/** Fallback for unknown paths — points back to the job list, the screening home page. */
export function NotFoundPage() {
  const { t } = useStore();
  const navigate = useNavigate();
  return (
    <div className="card card-pad" style={{ marginTop: 24 }}>
      <EmptyState
        icon="travel_explore"
        title={t("Page not found")}
        body={t("The page you are looking for doesn't exist or has moved.")}
        actions={
          <Button variant="primary" onClick={() => navigate("/jobs")}>
            {t("Back to job list")}
          </Button>
        }
      />
    </div>
  );
}
