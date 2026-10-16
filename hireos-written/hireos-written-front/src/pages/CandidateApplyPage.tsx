import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Button } from "../components/ui/Primitives";
import { DeadlineBanner, InvitationLetterCard } from "../components/InvitationLetterCard";
import { fetchPublicInvitation, submitPublicInvitation, type PublicInvitation } from "../data/writtenApi";

/**
 * The candidate-facing side of "send to candidate" — reached from the emailed /apply/:token link,
 * not from inside the app shell (no login, no sidebar; the unguessable token is the access control,
 * same as the HR-side drawer that generates it). Rendered as a standalone route outside <AppShell>
 * (see App.tsx) since a real external candidate should never see the internal HR chrome.
 */
export function CandidateApplyPage() {
  const { token = "" } = useParams();
  const { t } = useStore();
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; data: PublicInvitation }>({ status: "loading" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  // The backend refuses answers after they are due (DEADLINE_PASSED); the page closes the form at the same moment:
  // the due time the server works out — sooner than the deadline in timed mode (#129).
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const deadline = state.status === "ready" ? (state.data.dueAt ?? state.data.deadline) : null;
  useEffect(() => {
    if (!deadline) return;
    const check = () => {
      setNow(Date.now());
      setDeadlinePassed(Date.now() > new Date(deadline).getTime());
    };
    check();
    const timer = window.setInterval(check, 10_000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const timedDue = state.status === "ready" && state.data.mode === "timed" && state.data.dueAt ? new Date(state.data.dueAt) : null;

  useEffect(() => {
    let cancelled = false;
    fetchPublicInvitation(token)
      .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
      .catch(() => { if (!cancelled) setState({ status: "error" }); });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit() {
    if (state.status !== "ready" || deadlinePassed) return;
    const missing = state.data.questions.some((q) => !(answers[q.questionId] ?? "").trim());
    if (missing) return;
    setSubmitting(true);
    try {
      await submitPublicInvitation(
        token,
        state.data.questions.map((q) => ({ questionId: q.questionId, answerText: answers[q.questionId] ?? "" })),
      );
      setJustSubmitted(true);
    } catch (error) {
      if ((error as { code?: string }).code === "DEADLINE_PASSED") setDeadlinePassed(true);
      else setState({ status: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-2, #f6f7f8)", padding: "40px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {state.status === "loading" && <div className="card card-pad">{t("Loading…")}</div>}

        {state.status === "error" && (
          <div className="banner danger">{t("This link is invalid or has expired.")}</div>
        )}

        {state.status === "ready" && (state.data.submission || justSubmitted) && (
          <div className="card card-pad">
            <h2 style={{ marginBottom: 8 }}>{t("Thank you — your submission has been received.")}</h2>
            <div className="tiny" style={{ color: "var(--text-secondary)" }}>
              {t("The hiring team will review your answers and follow up with next steps.")}
            </div>
          </div>
        )}

        {state.status === "ready" && !state.data.submission && !justSubmitted && (
          <>
            {state.data.letter && <DeadlineBanner letter={state.data.letter} deadline={state.data.deadline} />}
            {timedDue && !deadlinePassed && (
              <div className="banner warning" style={{ marginBottom: 16 }} data-testid="timed-due">
                {t("Time limit: answers are due by %time (%left minutes left). The clock started when you first opened this page.")
                  .replace("%time", timedDue.toLocaleString())
                  .replace("%left", String(Math.max(0, Math.ceil((timedDue.getTime() - now) / 60_000))))}
              </div>
            )}
            {deadlinePassed && (
              <div className="banner danger" style={{ marginBottom: 16 }}>
                {t("The submission deadline has passed, so answers can no longer be submitted. If you have questions, please reply to the invitation email.")}
              </div>
            )}
            {state.data.letter && <InvitationLetterCard letter={state.data.letter} />}
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <h2 style={{ marginBottom: 4 }}>{state.data.jobTitle}</h2>
              <div className="tiny" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
                {t("Candidate")}: {state.data.candidateName}
              </div>
              <div className="tiny" style={{ color: "var(--text-tertiary)" }}>
                {state.data.mode === "timed"
                  ? `${t("Timed")} · ${state.data.durationMin} ${t("min timed")}`
                  : t("Deadline only")}
                {/* Without a letter (older backend) the deadline banner isn't shown, so keep it here. */}
                {!state.data.letter && state.data.deadline && <> · {t("deadline")} {new Date(state.data.deadline).toLocaleString()}</>}
              </div>
            </div>

            {state.data.questions.map((q) => (
              <div key={q.questionId} className="card card-pad" style={{ marginBottom: 16 }}>
                <b>{q.code} · {q.title}</b>
                <div className="tiny" style={{ color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: "10px 0" }}>
                  {q.prompt}
                </div>
                <div className="field">
                  <label>{t("Your answer")}</label>
                  <textarea
                    className="input"
                    rows={8}
                    disabled={deadlinePassed}
                    value={answers[q.questionId] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.questionId]: e.target.value }))}
                  />
                </div>
              </div>
            ))}

            <Button variant="primary" onClick={handleSubmit} disabled={submitting || deadlinePassed}>
              {submitting ? t("Submitting…") : t("Submit")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
