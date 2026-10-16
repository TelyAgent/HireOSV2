import { useEffect, useRef, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Modal } from "../../components/ui/Overlays";
import { Button } from "../../components/ui/Primitives";
import { getSourceMaterial, type SourceMaterial } from "../../data/api/candidates";

/**
 * The source material as stored, paragraph by paragraph with page markers (#155 #159). With `segmentId` the
 * paragraph a profile value came from is highlighted and scrolled to. Corrections never change this text.
 */
export function SourceMaterialModal({ materialId, segmentId, onClose }: { materialId: string; segmentId?: string; onClose: () => void }) {
  const { t, state } = useStore();
  const [material, setMaterial] = useState<SourceMaterial | null>(null);
  const [failed, setFailed] = useState(false);
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSourceMaterial(materialId)
      .then(setMaterial)
      .catch(() => setFailed(true));
  }, [materialId]);

  useEffect(() => {
    target.current?.scrollIntoView({ block: "center" });
  }, [material]);

  const segments = material?.segments ?? [];
  const unreadable = failed || (material && (material.readStatus !== "available" || !segments.length));
  const missingTarget = material && segmentId && !segments.some((s) => s.id === segmentId);
  let previousPage: number | undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={material?.name || t("Source material")}
      wide
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("Close")}
        </Button>
      }
    >
      <p className="tiny" style={{ marginBottom: 8 }}>
        {t("The material as received. Corrections never change it.")}
      </p>
      {!material && !failed && <p className="tiny">{t("Loading…")}</p>}
      {unreadable && <p className="tiny">{t("The source text isn't available, so it can't be shown.")}</p>}
      {missingTarget && <p className="tiny">{t("That location is no longer in this file.")}</p>}
      {!unreadable && material && (
        <div className="source-text" data-testid="source-text">
          {segments.map((segment, index) => {
            const pageMark = segment.page != null && segment.page !== previousPage;
            previousPage = segment.page;
            const hit = segment.id === segmentId;
            return (
              <div key={segment.id || index}>
                {pageMark && <div className="source-page">{state.lang === "zh" ? `第 ${segment.page} 页` : `Page ${segment.page}`}</div>}
                <div ref={hit ? target : undefined} className={`source-paragraph${hit ? " is-hit" : ""}`} data-segment-id={segment.id} data-hit={hit || undefined}>
                  {segment.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
