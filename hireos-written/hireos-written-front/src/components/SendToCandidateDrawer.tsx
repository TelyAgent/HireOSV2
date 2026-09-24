import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { useStore } from "../store/StoreContext";
import { Button } from "./ui/Primitives";
import { API_BASE_URL } from "../utils/apiBase";
import { createInvitation } from "../data/writtenApi";
import { CASES, CORE_APPLICATIONS, CORE_JOBS, CORE_CANDIDATES, INVITATIONS, QUESTIONS, type PlanItem, type Round } from "../data/fixtures";

type Step = "form" | "preview" | "sent";

/**
 * Ported from the prototype's openSendToCandidateDrawer(caseId, round, onSent) — a lightweight,
 * single-round "send this round's questions to this candidate" flow, distinct from the batch
 * InvitationComposerPage wizard used to invite several candidates at once.
 *
 * Unlike the prototype (which only ever simulated the send), this now calls the real
 * hireos-written-backend to create an Invitation with an unguessable token and shows the actual
 * /apply/:token link the candidate would receive by email — that link is a real, working public
 * page (see CandidateApplyPage) backed by a real Submission record when the candidate replies.
 * A case that only exists as fixture demo data (no real backend Case row) can't hold a real
 * invitation; the send still completes as a local simulation in that case, same as before.
 */
export function SendToCandidateDrawer({
  open, onClose, caseId, round, items, onSent,
}: {
  open: boolean;
  onClose: () => void;
  caseId: string;
  round: Round;
  items: PlanItem[];
  onSent: () => void;
}) {
  const { t, say } = useStore();
  const c = CASES[caseId];
  const cand = CORE_CANDIDATES[c.candidateId];
  const app = c.applicationId ? CORE_APPLICATIONS[c.applicationId] : undefined;
  const job = app ? CORE_JOBS[app.jobId] : undefined;

  const [step, setStep] = useState<Step>("form");
  const [mode, setMode] = useState<"timed" | "deadline_only">("timed");
  const [durationMin, setDurationMin] = useState(90);
  const [deadline, setDeadline] = useState("");
  const [disclosure, setDisclosure] = useState<"score_and_summary" | "summary_only">("score_and_summary");
  const [sending, setSending] = useState(false);
  const [sentLink, setSentLink] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setMode("timed");
    setDurationMin(90);
    setDeadline(round.deadlineAt ? round.deadlineAt.slice(0, 16) : "");
    setDisclosure("score_and_summary");
    setSentLink(null);
  }, [open, round.deadlineAt]);

  function goToPreview() {
    if (!deadline) {
      say(t("Set a deadline first."), { type: "danger" });
      return;
    }
    setStep("preview");
  }

  async function confirmSend() {
    setSending(true);
    const deadlineIso = new Date(`${deadline}:00Z`).toISOString();
    let token: string | undefined;
    try {
      const created = await createInvitation(caseId, {
        questions: items.map((pi) => {
          const q = QUESTIONS[pi.questionId];
          return { questionId: pi.questionId, code: q.code, title: q.title, prompt: pi.customPrompt ?? q.prompt };
        }),
        mode,
        durationMin: mode === "timed" ? durationMin : undefined,
        deadline: deadlineIso,
        disclosurePolicy: disclosure,
      });
      token = created.token;
    } catch {
      // Fixture-only demo case (no real backend Case row) -- fall back to a simulated send, same
      // as every other demo-only candidate in this app.
    }

    const invId = `inv_${caseId}_${round.id}`;
    INVITATIONS[invId] = {
      id: invId, caseId, questionIds: items.map((pi) => pi.questionId), mode,
      durationMin: mode === "timed" ? durationMin : undefined,
      deadline: deadlineIso,
      status: "sent", acceptedAt: null, startedAt: null, disclosurePolicy: disclosure, token,
    };
    c.status = "awaiting_acceptance";
    round.status = "invited";
    setSending(false);

    if (token) {
      setSentLink(`${window.location.origin}${API_BASE_URL}apply/${token}`);
      setStep("sent");
    } else {
      say(t("Invitation sent to candidate."), { type: "success" });
      onClose();
      onSent();
    }
  }

  function finish() {
    say(t("Invitation sent to candidate."), { type: "success" });
    onClose();
    onSent();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={
        <div>
          <div>{t("Send to candidate")}</div>
          <div className="tiny">{cand.name} · {cand.email}</div>
        </div>
      }
      footer={
        step === "form" ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
            <Button variant="primary" onClick={goToPreview}>{t("Preview form")}</Button>
          </div>
        ) : step === "preview" ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setStep("form")}>{t("Back")}</Button>
            <Button variant="primary" onClick={confirmSend} disabled={sending}>{sending ? t("Sending…") : t("Confirm send")}</Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="primary" onClick={finish}>{t("Done")}</Button>
          </div>
        )
      }
    >
      {step === "form" && (
        <>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>{t("Assessment questions")}</h4>
            {items.map((pi) => (
              <div key={pi.id} className="tiny" style={{ padding: "4px 0" }}>{QUESTIONS[pi.questionId].code} · {QUESTIONS[pi.questionId].title}</div>
            ))}
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>{t("Mode")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" variant={mode === "timed" ? "primary" : "ghost"} onClick={() => setMode("timed")}>{t("Timed")}</Button>
              <Button size="sm" variant={mode === "deadline_only" ? "primary" : "ghost"} onClick={() => setMode("deadline_only")}>{t("Deadline only")}</Button>
            </div>
          </div>

          {mode === "timed" && (
            <div className="field" style={{ marginBottom: 16 }}>
              <label>{t("Duration once started (minutes)")}</label>
              <input className="input" type="number" style={{ maxWidth: 160 }} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value) || 90)} />
            </div>
          )}

          <div className="field" style={{ marginBottom: 16 }}>
            <label>{t("Deadline")}</label>
            <input className="input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>{t("Result disclosure")}</label>
            {([["score_and_summary", t("Score + summary")], ["summary_only", t("Summary only (no numeric score)")]] as const).map(([val, label]) => (
              <label key={val} className="checkbox-row" style={{ marginBottom: 6, cursor: "pointer", display: "flex" }}>
                <input type="radio" name="sendDisc" checked={disclosure === val} onChange={() => setDisclosure(val)} /> {label}
              </label>
            ))}
          </div>

          <div className="banner info tiny">{t("From / Reply-To:")} hr@sendinglabs.com {t("(simulated)")}</div>
        </>
      )}

      {step === "preview" && (
        <>
          <div className="tiny" style={{ color: "var(--text-tertiary)", marginBottom: 12 }}>
            {t("This is exactly what the candidate will see when they open the form link.")}
          </div>
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="tiny" style={{ color: "var(--text-tertiary)", marginBottom: 4 }}>{t("Target role")}</div>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{job?.title ?? "—"}</div>
            <div className="tiny" style={{ color: "var(--text-tertiary)", marginBottom: 4 }}>
              {mode === "timed" ? `${t("Timed")} · ${durationMin} ${t("min timed")}` : t("Deadline only")} · {t("deadline")} {new Date(`${deadline}:00Z`).toLocaleString()}
            </div>
          </div>
          {items.map((pi) => {
            const q = QUESTIONS[pi.questionId];
            return (
              <div key={pi.id} className="card card-pad" style={{ marginBottom: 12 }}>
                <b>{q.code} · {q.title}</b>
                <div className="tiny" style={{ color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 8, maxHeight: 160, overflow: "auto" }}>
                  {pi.customPrompt ?? q.prompt}
                </div>
                <div className="field" style={{ marginTop: 10 }}>
                  <label className="tiny">{t("Candidate's answer")}</label>
                  <textarea className="input" rows={2} disabled placeholder={t("The candidate will type their answer here.")} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {step === "sent" && (
        <>
          <div className="banner success" style={{ marginBottom: 16 }}>{t("Invitation sent to candidate.")}</div>
          <div className="field" style={{ marginBottom: 16 }}>
            <label>{t("Form link")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" readOnly value={sentLink ?? ""} onFocus={(e) => e.target.select()} />
              <Button
                icon="content_copy"
                onClick={() => {
                  if (sentLink) navigator.clipboard?.writeText(sentLink);
                  say(t("Link copied."), { type: "success" });
                }}
              >
                {t("Copy")}
              </Button>
            </div>
          </div>
          <div className="banner info tiny">{t("An email containing this link has been sent to")} {cand.email} {t("(simulated)")}.</div>
        </>
      )}
    </Drawer>
  );
}
