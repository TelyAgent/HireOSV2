import { useNavigate } from "react-router-dom";
import { MainInner } from "../components/AppShell";
import { Button, EmptyState } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";

export function NotFoundPage() {
  const { t } = useStore();
  const navigate = useNavigate();
  return (
    <MainInner>
      <EmptyState
        icon="search_off"
        title={t("Page not found")}
        body={t("This route does not exist in the prototype.")}
        actions={
          <Button variant="primary" onClick={() => navigate("/home")}>
            {t("Go to Home")}
          </Button>
        }
      />
    </MainInner>
  );
}
