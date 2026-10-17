import { useStore } from "../store/StoreContext";
import { CloseSvg, ArrowRightSvg, FileSvg, SearchSvg } from "./ui/Icons";
import { Modal } from "antd";
import { useCreateProject, type ExternalJob } from "../features/project-intake/useCreateProject";
import { errorText, intakeText } from "../features/project-intake/i18n";

const jobMeta = (job: ExternalJob) => [job.team, job.location, job.seniority].filter(Boolean).join(" · ") || job.status;

export function CreateProjectModal() {
  const { state, set, t } = useStore();
  const form = useCreateProject();
  const it = intakeText(state.lang);
  const open = state.showCreateModal;

  const close_ = () => { if (!form.creating) { set({ showCreateModal: false }); form.reset(); } };

  if (!open) return null;

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      width={640}
      centered
      styles={{
        body: { padding: 0 },
        content: { padding: "26px 28px 22px", borderRadius: 18 },
      }}
      onCancel={close_}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10.5, letterSpacing: ".08em", color: "var(--ink-3)" }}>
            {t.newInterviewProject}
          </div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>{t.startWithJd}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-2)" }}>{t.jdSubtitle}</div>
        </div>
        <button
          aria-label={t.closeProjectDialog}
          onClick={close_}
          style={{ flex: "none", width: 28, height: 28, border: 0, background: "transparent", color: "var(--ink-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <CloseSvg />
        </button>
      </div>

      <div role="tablist" style={{ marginTop: 20, display: "inline-flex", padding: 3, gap: 2, borderRadius: 10, background: "var(--surface-3)" }}>
        {(["new", "existing"] as const).map((m) => {
          const active = form.mode === m;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={active}
              onClick={() => form.switchMode(m)}
              style={{
                height: 30, padding: "0 14px", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12.5,
                fontWeight: active ? 700 : 600, background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--brand)" : "var(--ink-2)", boxShadow: active ? "0 1px 2px rgba(15,23,42,.08)" : "none",
              }}
            >
              {m === "new" ? t.jdModeNew : t.jdModeExisting}
            </button>
          );
        })}
      </div>

      {form.mode === "new" && (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="jdTextInput" style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{t.jobDescription}</label>
          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: "var(--bad)", letterSpacing: ".02em" }}>{t.required}</div>
          <textarea
            id="jdTextInput"
            aria-invalid={form.jdRequired || undefined}
            aria-describedby={form.jdRequired ? 'jdRequiredError' : undefined}
            value={form.jdText}
            onChange={(e) => form.editJdText(e.target.value)}
            placeholder={t.jdPlaceholder}
            style={{
              marginTop: 8, width: "100%", height: 150, border: "1px solid var(--line-strong)", borderRadius: 11,
              padding: "12px 14px", fontSize: 13, color: "var(--ink-2)", background: "var(--surface)", lineHeight: 1.55,
              resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit",
            }}
          />
          {form.jdRequired && <div id="jdRequiredError" role="alert" style={{ marginTop: 6, color: 'var(--bad)', fontSize: 12.5 }}>{form.error}</div>}
          <label
            htmlFor="jdFileInput"
            style={{
              marginTop: 14, width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              border: "1px dashed var(--line-strong)", borderRadius: 12, background: "var(--surface-2)",
              cursor: form.jdFileBusy ? "progress" : "pointer", textAlign: "left", boxSizing: "border-box",
            }}
          >
            <input
              id="jdFileInput"
              type="file"
              accept=".pdf,.docx,.txt"
              disabled={form.jdFileBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void form.pickJdFile(f);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
            <span style={{ color: "var(--brand)", display: "flex" }}><FileSvg /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--brand)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {form.jdFile?.name || t.chooseJdFile}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{form.jdFileBusy ? it.uploading : t.chooseJdFileSub}</div>
            </div>
          </label>
        </div>
      )}

      {form.mode === "existing" && !form.pickedJob && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--line-strong)", borderRadius: 11, background: "var(--surface)" }}>
            <SearchSvg />
            <input
              autoFocus
              aria-label={t.searchJobsPlaceholder}
              value={form.query}
              onChange={(e) => void form.search(e.target.value)}
              placeholder={t.searchJobsPlaceholder}
              style={{ flex: 1, border: 0, outline: "none", fontSize: 13.5, background: "transparent", color: "var(--ink)" }}
            />
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {form.searching && <div style={{ padding: "10px 2px", fontSize: 12.5, color: "var(--ink-3)" }}>{it.loading}</div>}
            {!form.searching && form.results.length === 0 && <div style={{ padding: "10px 2px", fontSize: 12.5, color: "var(--ink-3)" }}>{t.noJobsFound}</div>}
            {form.results.map((job) => (
              <button
                key={job.id}
                onClick={() => form.setPickedJob(job)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 11, background: "var(--surface)", cursor: "pointer", textAlign: "left" }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{job.title}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>{jobMeta(job)}</div>
                </div>
                <ArrowRightSvg />
              </button>
            ))}
          </div>
        </div>
      )}

      {form.mode === "existing" && form.pickedJob && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid var(--line-strong)", borderRadius: 11, background: "var(--surface-2)" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{form.pickedJob.title}</div>
            <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>{jobMeta(form.pickedJob)}</div>
          </div>
          <button onClick={() => form.setPickedJob(undefined)} style={{ border: 0, background: "transparent", color: "var(--brand)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {t.changeJob}
          </button>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.candidateResume}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{t.candidateResumeSub}</div>
        </div>
        <label htmlFor="resumeFileInput" style={{ flex: "none", display: "flex", alignItems: "center", gap: 5, color: "var(--brand)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <input
            id="resumeFileInput"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void form.pickResume(f);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          {!form.resume && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"></path>
            </svg>
          )}
          {form.resume ? t.replaceResume : t.uploadResume}
        </label>
      </div>

      {form.resume && (
        <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 9, background: "var(--surface-2)", fontSize: 12 }}>
          <FileSvg size={16} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {form.resume.name}
            <small style={{ display: "block", whiteSpace: "normal", color: form.resume.error ? "var(--bad)" : "var(--ink-3)" }}>
              {form.resume.uploading ? it.uploading : form.resume.error ? errorText(form.resume.error, state.lang) : it.available}
            </small>
          </span>
          {form.resume.error && !form.resume.material && (
            <button onClick={() => void form.pickResume(form.resume!.file)} style={{ border: 0, background: "transparent", color: "var(--brand)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {it.retry}
            </button>
          )}
          <button aria-label={it.remove} onClick={form.removeResume} style={{ border: 0, background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 12 }}>
            ✕
          </button>
        </div>
      )}

      {form.error && !form.jdRequired && <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: "var(--bad)" }}>{form.error}</div>}
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 16 }}>
        <button
          onClick={close_}
          style={{ border: 0, background: "transparent", color: "var(--brand)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
        >
          {t.cancel}
        </button>
        <button
          onClick={() => void form.create()}
          disabled={form.busy}
          style={{
            height: 40, padding: "0 18px", border: "1px solid var(--brand)", borderRadius: 10, background: "var(--brand)",
            color: "var(--brand-ink)", fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8,
            cursor: form.busy ? "not-allowed" : "pointer", opacity: form.busy ? 0.6 : 1,
          }}
        >
          {form.creating ? (form.mode === "new" ? it.readingJd : it.submitting) : t.createProject}
          <ArrowRightSvg />
        </button>
      </div>
    </Modal>
  );
}

export function EvidenceRequestModal() {
  const { state, set, say, t } = useStore();
  const open = state.showEvidenceRequest;

  const owners = [
    { k: "hm", label: "David Kim (Hiring Manager)" },
    { k: "iv", label: "Priya Nair (Interviewer)" },
    { k: "hr", label: "Sarah Chen (HR)" },
  ] as const;

  const formats = [
    { k: "panel", label: "1:1 follow-up" },
    { k: "work_sample", label: "Work sample" },
  ] as const;

  const dues = ["Sep 12, 2026", "Sep 15, 2026"];

  if (!open) return null;

  const close = () => set({ showEvidenceRequest: false });

  const submit = () => {
    const ownerName =
      state.evidenceOwner === "hm"
        ? "David Kim"
        : state.evidenceOwner === "iv"
          ? "Priya Nair"
          : "Sarah Chen";
    const roundNum = 3 + state.followUpRounds.length;
    set({
      showEvidenceRequest: false,
      decision: null,
      decHr: false,
      decHm: false,
      decRecorded: false,
      followUpRounds: state.followUpRounds.concat([
        {
          id: "r" + roundNum,
          name: `Round ${roundNum} — Security & Compliance Follow-up`,
          meta: `Due ${state.evidenceDue} · Owner: ${ownerName}`,
          status: "Planned",
          tags: ["Security & Compliance Awareness"],
          qLabel: "1 question (1 mandatory)",
          due: state.evidenceDue,
          ownerName,
          ownerInitials: ownerName
            .split(" ")
            .map((n) => n[0])
            .join(""),
          format: state.evidenceFormat,
        },
      ]),
      screen: "plan",
    });
    say(
      `Follow-up round created to verify Security & Compliance Awareness, owned by ${ownerName}. Schedule it from the plan below — the decision is cleared until this evidence comes back.`,
    );
  };

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      width={520}
      centered
      styles={{ body: { padding: 0 }, content: { padding: "22px 24px", borderRadius: 16 } }}
      onCancel={close}
    >
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10.5,
          letterSpacing: ".06em",
          color: "var(--ink-3)",
        }}
      >
        {t.requestMoreEvidenceTitle}
      </div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>
        {t.closeSecurityGap}
      </div>
      <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600 }}>
        {t.evidenceGap}
      </div>
      <div
        style={{
          marginTop: 4,
          padding: "10px 12px",
          border: "1px solid var(--warn)",
          borderRadius: 10,
          background: "var(--warn-soft)",
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        Security &amp; Compliance Awareness — Must-have, required L3, currently
        Unknown (only a generic, unverifiable answer was given).
      </div>
      <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600 }}>{t.owner}</div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {owners.map((o) => (
          <button
            key={o.k}
            onClick={() => set({ evidenceOwner: o.k })}
            style={{
              height: 30,
              padding: "0 11px",
              border: `1px solid ${
                state.evidenceOwner === o.k ? "var(--brand)" : "var(--line)"
              }`,
              borderRadius: 8,
              background:
                state.evidenceOwner === o.k ? "var(--brand-soft)" : "var(--surface)",
              color:
                state.evidenceOwner === o.k ? "var(--brand)" : "var(--ink-2)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600 }}>{t.format}</div>
      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {formats.map((o) => (
          <button
            key={o.k}
            onClick={() => set({ evidenceFormat: o.k })}
            style={{
              height: 30,
              padding: "0 11px",
              border: `1px solid ${
                state.evidenceFormat === o.k ? "var(--brand)" : "var(--line)"
              }`,
              borderRadius: 8,
              background:
                state.evidenceFormat === o.k ? "var(--brand-soft)" : "var(--surface)",
              color:
                state.evidenceFormat === o.k ? "var(--brand)" : "var(--ink-2)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600 }}>{t.dueDate}</div>
      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {dues.map((d) => (
          <button
            key={d}
            onClick={() => set({ evidenceDue: d })}
            style={{
              height: 30,
              padding: "0 11px",
              border: `1px solid ${
                state.evidenceDue === d ? "var(--brand)" : "var(--line)"
              }`,
              borderRadius: 8,
              background: state.evidenceDue === d ? "var(--brand-soft)" : "var(--surface)",
              color: state.evidenceDue === d ? "var(--brand)" : "var(--ink-2)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {d}
          </button>
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid var(--line)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 14,
        }}
      >
        <button
          onClick={close}
          style={{
            border: 0,
            background: "transparent",
            color: "var(--brand)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.cancel}
        </button>
        <button
          onClick={submit}
          style={{
            height: 36,
            padding: "0 16px",
            border: "1px solid var(--brand)",
            borderRadius: 10,
            background: "var(--brand)",
            color: "var(--brand-ink)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {t.createFollowUpRound}
        </button>
      </div>
    </Modal>
  );
}
