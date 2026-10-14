import { useStore } from "../../store/StoreContext";
import { Button } from "./Primitives";
import { Icon } from "./Icons";

/** Shown when background work outlives the polling window — instead of polling stopping silently. */
export function StillProcessingNotice({ onRetry, style }: { onRetry: () => void; style?: React.CSSProperties }) {
  const { t } = useStore();
  return (
    <div className="still-processing" role="status" style={style}>
      <Icon name="hourglass_top" />
      <span>{t("Still processing — it has been more than 90 seconds.")}</span>
      <Button size="sm" variant="secondary" icon="refresh" onClick={onRetry}>
        {t("Retry")}
      </Button>
    </div>
  );
}
