import { useStore } from "../store/StoreContext";
import { CloseSvg, ArrowRightSvg, FileSvg, SearchSvg } from "./ui/Icons";
import { Modal } from "antd";
import { useAttachJob } from "../features/project-intake/useAttachJob";
import { errorText, intakeText } from "../features/project-intake/i18n";

export function CreateProjectModal() {
  const { state, set, t } = useStore();
  const form = useAttachJob();
  const it = intakeText(state.lang);
  const open = state.showCreateModal;

  const close_ = () => { if (!form.busy) { set({ showCreateModal: false }); form.back(); } };

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
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5,
              letterSpacing: ".08em",
              color: "var(--ink-3)",
            }}
          >
            {t.newInterviewProject}
          </div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>
            {t.pickJobTitle}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-2)" }}>
            {t.pickJobSubtitle}
          </div>
        </div>
        <button
          aria-label={t.closeProjectDialog}
          onClick={close_}
          style={{
            flex: "none",
            width: 28,
            height: 28,
            border: 0,
            background: "transparent",
            color: "var(--ink-3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CloseSvg />
        </button>
      </div>

      {!form.job && (
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              border: "1px solid var(--line-strong)",
              borderRadius: 11,
              background: "var(--surface)",
            }}
          >
            <SearchSvg />
            <input
              autoFocus
              aria-label={t.searchJobsPlaceholder}
              value={form.query}
              onChange={(e) => void form.search(e.target.value)}
              placeholder={t.searchJobsPlaceholder}
              style={{
                flex: 1,
                border: 0,
                outline: "none",
                fontSize: 13.5,
                background: "transparent",
                color: "var(--ink)",
              }}
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
            {form.searching && <div style={{ padding: "10px 2px", fontSize: 12.5, color: "var(--ink-3)" }}>{it.loading}</div>}
            {!form.searching && form.results.length === 0 && (
              <div style={{ padding: "10px 2px", fontSize: 12.5, color: "var(--ink-3)" }}>{t.noJobsFound}</div>
            )}
            {form.results.map((job) => (
              <button
                key={job.id}
                disabled={form.attaching}
                onClick={() => void form.pick(job.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "12px 14px",
                  border: "1px solid var(--line)",
                  borderRadius: 11,
                  background: "var(--surface)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{job.title}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>
                    {[job.team, job.location, job.seniority].filter(Boolean).join(" · ") || job.status}
                  </div>
                </div>
                <ArrowRightSvg />
              </button>
            ))}
          </div>
        </div>
      )}

      {form.job && (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              border: "1px solid var(--line-strong)",
              borderRadius: 11,
              background: "var(--surface-2)",
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{form.job.title}</div>
              <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--ink-3)" }}>
                {[form.job.department, form.job.location, form.job.level].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button
              onClick={form.back}
              style={{ border: 0, background: "transparent", color: "var(--brand)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              {t.changeJob}
            </button>
          </div>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.resumesTitle}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{t.resumesSub}</div>
            </div>
            <label
              htmlFor="resumesFileInput"
              style={{
                flex: "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "var(--brand)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <input
                id="resumesFileInput"
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  form.addResumes(files);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
              {t.addResumes}
            </label>
          </div>

          {form.resumes.length > 0 && (
            <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
              {form.resumes.map((m) => (
                <div
                  key={m.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    border: "1px solid var(--line)",
                    borderRadius: 9,
                    background: "var(--surface-2)",
                    fontSize: 12,
                  }}
                >
                  <FileSvg />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.name}
                    <small style={{ display: 'block', whiteSpace: 'normal' }}>
                      {m.uploading ? it.uploading : (m.error || m.material?.errorCode) ? errorText(m.error || m.material!.errorCode!, state.lang) : it.available}
                    </small>
                  </span>
                  {m.error && <button onClick={() => void form.uploadResume(m)}>{it.retry}</button>}
                  <button
                    aria-label={it.remove}
                    onClick={() => form.setResumes((rows) => rows.filter((x) => x.key !== m.key))}
                    style={{ border: 0, background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {form.error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>{form.error}</div>}
      <div
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 16,
        }}
      >
        <button
          onClick={close_}
          style={{
            border: 0,
            background: "transparent",
            color: "var(--brand)",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.cancel}
        </button>
        {form.job && (
          <button
            onClick={form.finish}
            disabled={form.busy}
            style={{
              height: 40,
              padding: "0 18px",
              border: "1px solid var(--brand)",
              borderRadius: 10,
              background: "var(--brand)",
              color: "var(--brand-ink)",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {t.doneButton}
            <ArrowRightSvg />
          </button>
        )}
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
