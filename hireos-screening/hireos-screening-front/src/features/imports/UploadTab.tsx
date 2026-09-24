import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import {
  cancelImportBatch,
  getImportBatch,
  retryImportItem,
  runImportBatch,
  simulateSampleBatch,
  type ImportBatch,
  type ImportItemResult,
} from "../../data/api/imports";
import { delay } from "../../data/api/shared";
import { Icon } from "../../components/ui/Icons";
import { Badge, Button } from "../../components/ui/Primitives";
import { describeItem, formatFileSize } from "./importOutcome";

interface Run {
  id: string;
  fileCount: number;
  batch?: ImportBatch;
}

const POLL_INTERVAL_MS = 700;
const POLL_TIMEOUT_MS = 30_000;

/** Real uploads hand candidate creation off to an async job (import chain plan,
 * Phase 1) and return while it's still in flight. Poll until the batch leaves
 * "processing" so the UI reflects what actually happened instead of a stale
 * first response. No-op for mock batches, which are always already terminal. */
async function pollUntilSettled(batch: ImportBatch, onUpdate: (batch: ImportBatch) => void): Promise<void> {
  const startedAt = Date.now();
  let current = batch;
  while (current.status === "processing" && Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await delay(POLL_INTERVAL_MS);
    current = await getImportBatch(batch.id);
    onUpdate(current);
  }
}

function ImportItemRow({ item, onRetry, retrying }: { item: ImportItemResult; onRetry: () => void; retrying: boolean }) {
  const { t } = useStore();
  const { tone, label, detail } = describeItem(item);
  let action: React.ReactNode = null;
  if (item.status === "needs_review" && item.duplicateReviewId) {
    action = (
      <Link className="btn btn-sm btn-secondary" to={`/duplicates/${item.duplicateReviewId}`}>
        {t("Review", "Review (action)")}
      </Link>
    );
  } else if (item.status === "completed" && item.candidateId) {
    action = (
      <Link className="btn btn-sm btn-secondary" to={`/candidates/${item.candidateId}`}>
        {t("Open profile")}
      </Link>
    );
  } else if (item.status === "failed" && item.retryable) {
    action = (
      <Button variant="secondary" size="sm" onClick={onRetry} disabled={retrying}>
        {t("Retry")}
      </Button>
    );
  } else if (item.outcome === "quarantined") {
    action = <span className="tiny muted">{t("File isolated — not sent to AI")}</span>;
  } else if (item.outcome === "too_large" || item.outcome === "unsupported_type") {
    action = <span className="tiny muted">{t("Not accepted")}</span>;
  } else if (item.status === "processing") {
    action = <span className="tiny muted">{t("Working…")}</span>;
  } else {
    action = <span className="tiny muted">{t("No action needed")}</span>;
  }

  return (
    <div className="list-row" style={{ padding: "10px 4px" }}>
      <Icon name="description" style={{ color: "var(--text-tertiary)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--fs-sm)" }}>
          {item.fileName} <span className="tiny muted">({formatFileSize(item.sizeKB)})</span>
        </div>
        <div className="tiny">{t(detail)}</div>
      </div>
      <Badge tone={tone}>{t(label)}</Badge>
      <div style={{ width: 130, textAlign: "right" }}>{action}</div>
    </div>
  );
}

function BatchCard({
  run,
  onRetryItem,
  retryingId,
  onCancel,
  cancelling,
}: {
  run: Run;
  onRetryItem: (itemId: string) => void;
  retryingId: string | null;
  onCancel: (batchId: string) => void;
  cancelling: boolean;
}) {
  const { t } = useStore();
  if (!run.batch) {
    return (
      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>
            {t("Batch")} — 0/{run.fileCount} {t("processed")}
          </div>
          <span className="tiny muted">{t("Processing…")}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: "35%" }} />
        </div>
      </div>
    );
  }
  const batch = run.batch;
  const doneCount = batch.items.filter((i) => i.status !== "processing").length;
  const failCount = batch.items.filter((i) => i.status === "failed").length;
  const isProcessing = batch.status === "processing";
  const stateBadge = isProcessing ? (
    <Badge tone="neutral">{t("Processing…")}</Badge>
  ) : failCount === 0 ? (
    <Badge tone="success">{t("Succeeded")}</Badge>
  ) : failCount === batch.items.length ? (
    <Badge tone="danger">{t("Failed")}</Badge>
  ) : (
    <Badge tone="warning">{t("Partially succeeded")}</Badge>
  );
  return (
    <div className="card card-pad" style={{ marginTop: 14 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div className="section-title" style={{ margin: 0 }}>
          {t("Batch")} {batch.id} — {doneCount}/{batch.items.length} {t("processed")}
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {isProcessing && (
            <Button variant="secondary" size="sm" onClick={() => onCancel(batch.id)} disabled={cancelling}>
              {t("Cancel")}
            </Button>
          )}
          {stateBadge}
        </div>
      </div>
      <div className="progress-track" style={{ marginBottom: 14 }}>
        <div className="progress-fill" style={{ width: `${batch.items.length ? Math.round((doneCount / batch.items.length) * 100) : 100}%` }} />
      </div>
      {batch.items.map((item) => (
        <ImportItemRow key={item.id} item={item} onRetry={() => onRetryItem(item.id)} retrying={retryingId === item.id} />
      ))}
    </div>
  );
}

export function UploadTab({ onChanged }: { onChanged?: () => void }) {
  const { t, say } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const applyBatchUpdate = (id: string, batch: ImportBatch) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, batch } : r)));
    onChanged?.();
  };

  const finishRun = async (id: string, batch: ImportBatch) => {
    applyBatchUpdate(id, batch);
    if (batch.status === "processing") {
      await pollUntilSettled(batch, (updated) => applyBatchUpdate(id, updated));
    }
  };

  const startRun = async (files: File[]) => {
    const id = "run-" + Date.now();
    setRuns((prev) => [{ id, fileCount: files.length }, ...prev]);
    const batch = files.length ? await runImportBatch(files) : await simulateSampleBatch();
    await finishRun(id, batch);
  };

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length) startRun(files);
  };

  const handleSample = async () => {
    const id = "run-" + Date.now();
    setRuns((prev) => [{ id, fileCount: 6 }, ...prev]);
    const batch = await simulateSampleBatch();
    await finishRun(id, batch);
  };

  const handleRetryItem = async (runId: string, itemId: string) => {
    setRetryingId(itemId);
    try {
      const batch = await retryImportItem(itemId);
      say(t("Retry queued"));
      await finishRun(runId, batch);
    } catch {
      say(t("This import item cannot be retried without a new upload."), { type: "error" });
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancel = async (runId: string, batchId: string) => {
    setCancellingId(batchId);
    try {
      const batch = await cancelImportBatch(batchId);
      applyBatchUpdate(runId, batch);
      say(t("Batch cancelled"));
    } catch {
      say(t("Could not cancel this batch."), { type: "error" });
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <>
      <div
        className={`card card-pad upload-dropzone${dragOver ? " drag-over" : ""}`}
        style={{ border: "2px dashed var(--border-strong)", textAlign: "center", padding: "40px 20px", cursor: "pointer" }}
        onClick={() => document.getElementById("upload-file-input")?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          id="upload-file-input"
          multiple
          accept=".pdf,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          style={{ display: "none" }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Icon name="cloud_upload" size={36} style={{ color: "var(--text-tertiary)" }} />
        <h3 style={{ margin: "8px 0 4px", fontWeight: 500 }}>{t("Drag files here, or click to choose")}</h3>
        <p className="tiny">{t("Supports PDF, DOCX, TXT · Up to 25 MB per file · No job selection required")}</p>
        <Button
          variant="primary"
          style={{ marginTop: 10 }}
          onClick={(e) => {
            e.stopPropagation();
            document.getElementById("upload-file-input")?.click();
          }}
        >
          {t("Choose files")}
        </Button>
      </div>
      <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
        <span className="tiny muted">{t("No real files handy? Use sample data instead.")}</span>
        <Button variant="secondary" size="sm" icon="science" onClick={handleSample}>
          {t("Simulate a batch (sample data)")}
        </Button>
      </div>
      {runs.map((run) => (
        <BatchCard
          key={run.id}
          run={run}
          onRetryItem={(itemId) => handleRetryItem(run.id, itemId)}
          retryingId={retryingId}
          onCancel={(batchId) => handleCancel(run.id, batchId)}
          cancelling={cancellingId === run.batch?.id}
        />
      ))}
    </>
  );
}
