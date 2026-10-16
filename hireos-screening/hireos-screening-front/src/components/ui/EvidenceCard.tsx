import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { getEvidenceById } from "../../data/db";
import { Badge, Button } from "./Primitives";
import { SourceMaterialModal } from "../../features/candidates/SourceMaterialModal";

const RESTRICTED_VIEWERS = ["emma", "daniel"];

/** Located in the source, not found there, or the source can't be read — never "verified" by default (#192). */
const LOCATED: Record<string, { tone: "success" | "warning" | "outline"; label: string }> = {
  located: { tone: "success", label: "Found in the source" },
  not_located: { tone: "warning", label: "Not found in the source — to be checked" },
  source_unavailable: { tone: "outline", label: "Source unavailable — to be checked" },
};

export function EvidenceCard({ evidenceId, relationship }: { evidenceId: string; relationship: "Supports" | "Contradicts" }) {
  const { state, t } = useStore();
  const [open, setOpen] = useState(false);
  const evidence = getEvidenceById(evidenceId);
  if (!evidence) return null;
  const restricted = evidence.availability === "restricted" && !RESTRICTED_VIEWERS.includes(state.currentUser);
  const status = evidence.located ? LOCATED[evidence.located] : null;
  const where = evidence.location
    ? state.lang === "zh"
      ? `${evidence.location.page != null ? `第 ${evidence.location.page} 页 · ` : ""}第 ${evidence.location.paragraph} 段`
      : `${evidence.location.page != null ? `page ${evidence.location.page} · ` : ""}paragraph ${evidence.location.paragraph}`
    : evidence.locator
      ? evidence.locator.type === "pdf"
        ? `${t("page")} ${evidence.locator.page}`
        : evidence.locator.type === "text"
          ? evidence.locator.section
          : evidence.locator.noteId
      : null;

  return (
    <div className="card card-pad" style={{ marginBottom: 10 }} data-testid="evidence-card" data-located={evidence.located}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <Badge tone={relationship === "Contradicts" ? "danger" : "info"}>{t(relationship)}</Badge>
        {status ? (
          <Badge tone={status.tone}>{t(status.label)}</Badge>
        ) : (
          <Badge tone={evidence.verification === "verified" ? "success" : "outline"}>
            {t(evidence.verification === "verified" ? "Verified" : "Unverified")}
          </Badge>
        )}
      </div>
      {restricted ? (
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-tertiary)", fontStyle: "italic" }}>
          {t("Restricted — visible to authorized HR/HM roles only.")}
        </p>
      ) : (
        <p style={{ fontSize: "var(--fs-sm)" }}>&ldquo;{evidence.statement}&rdquo;</p>
      )}
      <div className="tiny flex items-center gap-8 flex-wrap" style={{ marginTop: 6 }}>
        <span>
          {evidence.sourceLabel}
          {evidence.resumeVersion != null ? ` · ${t("résumé")} v${evidence.resumeVersion}` : ""}
          {where ? ` · ${where}` : ""}
        </span>
        {!restricted && evidence.materialId && evidence.location && (
          <Button variant="text" size="sm" onClick={() => setOpen(true)} data-testid="open-source">
            {t("View source")}
          </Button>
        )}
      </div>
      {open && evidence.materialId && (
        <SourceMaterialModal materialId={evidence.materialId} segmentId={evidence.location?.segmentId} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
