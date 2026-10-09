import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import {
  cancelImportBatch,
  getImportBatch,
  retryImportItem,
  runImportBatch,
  type ImportBatch,
  type ImportItemResult,
  type JobMatchProgress,
  type JobMatchResult,
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
/** Job-scoped imports also wait for profile parse + AI match, which can take minutes. */
const JOB_MATCH_POLL_TIMEOUT_MS = 5 * 60_000;
const JOB_MATCH_POLL_INTERVAL_MS = 2_000;

/** A job-scoped batch isn't settled until every created candidate has a match outcome. */
function jobMatchPending(batch: ImportBatch) {
  return Boolean(batch.targetJobId) && batch.items.some((i) => i.status === "completed" && i.candidateId && i.jobMatch?.stage !== "done");
}

function isUnsettled(batch: ImportBatch) {
  return batch.status === "processing" || jobMatchPending(batch);
}

/** Real uploads hand candidate creation off to an async job (import chain plan,
 * Phase 1) and return while it's still in flight. Poll until the batch leaves
 * "processing" -- and, for imports from a job, until each resume has been parsed and
 * matched against it -- so the UI reflects what actually happened. */
async function pollUntilSettled(batch: ImportBatch, onUpdate: (batch: ImportBatch) => void): Promise<void> {
  const startedAt = Date.now();
  const timeout = batch.targetJobId ? JOB_MATCH_POLL_TIMEOUT_MS : POLL_TIMEOUT_MS;
  let current = batch;
  while (isUnsettled(current) && Date.now() - startedAt < timeout) {
    if (current.status !== "processing") {
      await delay(JOB_MATCH_POLL_INTERVAL_MS - POLL_INTERVAL_MS);
    }
    await delay(POLL_INTERVAL_MS);
    current = await getImportBatch(batch.id);
    onUpdate(current);
  }
}

const MATCH_RESULT: Record<JobMatchResult, { tone: "success" | "neutral" | "outline" | "warning" | "danger"; label: string }> = {
  matched: { tone: "success", label: "Matched — added to AI suggestions" },
  no_match: { tone: "outline", label: "Below match threshold" },
  already_linked: { tone: "neutral", label: "Already linked to this job" },
  job_not_open: { tone: "warning", label: "Job is not open — not matched" },
  criteria_not_confirmed: { tone: "warning", label: "Job criteria not confirmed — not matched" },
  not_evaluated: { tone: "warning", label: "Could not evaluate against this job" },
  parse_failed: { tone: "danger", label: "Resume parsing failed" },
  match_failed: { tone: "danger", label: "Matching failed" },
};

/** Parse → match → result for one resume imported from a job's screening workspace. */
function JobMatchSteps({ progress }: { progress?: JobMatchProgress }) {
  const { t } = useStore();
  const stage = progress?.stage ?? "parsing";
  const failedAt = progress?.result === "parse_failed" ? "parse" : progress?.result === "match_failed" ? "match" : null;
  const step = (key: "parse" | "match" | "result", label: string) => {
    const order = { parse: 0, match: 1, result: 2 }[key];
    const current = { parsing: 0, matching: 1, done: 2 }[stage];
    const state = failedAt === key ? "failed" : order < current || (stage === "done" && key === "result") ? "done" : order === current ? "active" : "todo";
    return (
      <span className={`jm-step jm-${state}`}>
        <Icon name={state === "done" ? "check_circle" : state === "failed" ? "error" : state === "active" ? "progress_activity" : "radio_button_unchecked"} size={14} />
        {t(label)}
      </span>
    );
  };
  const outcome = progress?.result ? MATCH_RESULT[progress.result] : null;
  return (
    <div className="jm-row">
      {step("parse", stage === "parsing" ? "Parsing resume…" : "Parsed")}
      <span className="jm-sep" />
      {step("match", stage === "matching" ? "Matching against this job…" : "Matched against job")}
      <span className="jm-sep" />
      {outcome ? (
        <Badge tone={outcome.tone}>
          {t(outcome.label)}
          {progress?.score != null && ` · ${Math.round(progress.score)}`}
        </Badge>
      ) : (
        <span className="jm-step jm-todo">{t("Result")}</span>
      )}
    </div>
  );
}

function ImportItemRow({
  item,
  onRetry,
  retrying,
  jobScoped,
}: {
  item: ImportItemResult;
  onRetry: () => void;
  retrying: boolean;
  jobScoped: boolean;
}) {
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
        {jobScoped && item.status === "completed" && item.candidateId && <JobMatchSteps progress={item.jobMatch} />}
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
  const jobScoped = Boolean(batch.targetJobId);
  // From a job, an item is only "done" once its match against that job has an outcome.
  const isItemDone = (i: ImportItemResult) =>
    i.status !== "processing" && !(jobScoped && i.status === "completed" && i.candidateId && i.jobMatch?.stage !== "done");
  const doneCount = batch.items.filter(isItemDone).length;
  const failCount = batch.items.filter((i) => i.status === "failed").length;
  const isProcessing = batch.status === "processing";
  const isMatching = !isProcessing && jobMatchPending(batch);
  const stateBadge = isProcessing ? (
    <Badge tone="neutral">{t("Processing…")}</Badge>
  ) : isMatching ? (
    <Badge tone="neutral">{t("Matching…")}</Badge>
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
        <ImportItemRow key={item.id} item={item} jobScoped={jobScoped} onRetry={() => onRetryItem(item.id)} retrying={retryingId === item.id} />
      ))}
    </div>
  );
}

/** Import batches started from one tab: upload, poll to settled, retry/cancel, and the
 * batch cards that show their progress. Shared by the file upload and paste tabs. */
export function useImportRuns({ jobId, onChanged }: { jobId?: string; onChanged?: () => void }) {
  const { t, say } = useStore();
  const [runs, setRuns] = useState<Run[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const applyBatchUpdate = (id: string, batch: ImportBatch) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, batch } : r)));
    onChanged?.();
  };

  const finishRun = async (id: string, batch: ImportBatch) => {
    applyBatchUpdate(id, batch);
    if (isUnsettled(batch)) {
      await pollUntilSettled(batch, (updated) => applyBatchUpdate(id, updated));
    }
  };

  const startRun = async (files: File[]) => {
    const id = "run-" + Date.now();
    setRuns((prev) => [{ id, fileCount: files.length }, ...prev]);
    const batch = await runImportBatch(files, { jobId });
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

  const runCards = runs.map((run) => (
    <BatchCard
      key={run.id}
      run={run}
      onRetryItem={(itemId) => handleRetryItem(run.id, itemId)}
      retryingId={retryingId}
      onCancel={(batchId) => handleCancel(run.id, batchId)}
      cancelling={cancellingId === run.batch?.id}
    />
  ));

  return { startRun, runCards };
}

export function UploadTab({ onChanged, jobId }: { onChanged?: () => void; jobId?: string }) {
  const { t } = useStore();
  const [dragOver, setDragOver] = useState(false);
  const { startRun, runCards } = useImportRuns({ jobId, onChanged });

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length) startRun(files);
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
        <p className="tiny">
          {jobId
            ? t("Supports PDF, DOCX, TXT · Up to 25 MB per file · Matched against this job only")
            : t("Supports PDF, DOCX, TXT · Up to 25 MB per file · No job selection required")}
        </p>
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
      {runCards}
    </>
  );
}
