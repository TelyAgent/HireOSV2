import { useStore } from "../../store/StoreContext";
import { getEvidenceById } from "../../data/db";
import { pct } from "../../lib/format";
import { Badge } from "./Primitives";

const RESTRICTED_VIEWERS = ["emma", "daniel"];

export function EvidenceCard({ evidenceId, relationship }: { evidenceId: string; relationship: "Supports" | "Contradicts" }) {
  const { state, t } = useStore();
  const evidence = getEvidenceById(evidenceId);
  if (!evidence) return null;
  const restricted = evidence.availability === "restricted" && !RESTRICTED_VIEWERS.includes(state.currentUser);
  const locatorText =
    evidence.locator.type === "pdf" ? `${t("page")} ${evidence.locator.page}` : evidence.locator.type === "text" ? evidence.locator.section : evidence.locator.noteId;
  const kindLabel = evidence.kind.replace(/_/g, " ");

  return (
    <div className="card card-pad" style={{ marginBottom: 10 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <Badge tone={relationship === "Contradicts" ? "danger" : "info"}>{t(relationship)}</Badge>
        <Badge tone={evidence.verification === "verified" ? "success" : "outline"}>
          {t(evidence.verification.charAt(0).toUpperCase() + evidence.verification.slice(1))}
        </Badge>
      </div>
      {restricted ? (
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-tertiary)", fontStyle: "italic" }}>
          {t("Restricted — visible to authorized HR/HM roles only.")}
        </p>
      ) : (
        <p style={{ fontSize: "var(--fs-sm)" }}>&ldquo;{evidence.statement}&rdquo;</p>
      )}
      <div className="tiny" style={{ marginTop: 6 }}>
        {evidence.sourceLabel} · {locatorText} · {t("kind:")} {kindLabel} · {t("confidence")} {pct(evidence.confidence)}
      </div>
    </div>
  );
}
