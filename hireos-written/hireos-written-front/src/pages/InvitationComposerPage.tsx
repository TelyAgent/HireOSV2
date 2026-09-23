import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { PageHeader, Button, Card, Chip } from "../components/ui/Primitives";
import { CASES, CORE_CANDIDATES, PLANS, QUESTIONS, PROJECT, fmtDateShort, TZ, type Case } from "../data/fixtures";

type Recipient = { caseId: string; name: string; email: string; isNew?: boolean };
type DeliveryRow = Recipient & { status: "sent" | "bounced" };

function planItemsForCase(caseId: string) {
  return Object.values(PLANS).filter((pi) => pi.caseId === caseId);
}

function candidateName(caseId: string) {
  const c = CASES[caseId] as Case | undefined;
  return c ? CORE_CANDIDATES[c.candidateId]?.name ?? "—" : "—";
}
function candidateEmail(caseId: string) {
  const c = CASES[caseId] as Case | undefined;
  return c ? CORE_CANDIDATES[c.candidateId]?.email ?? "—" : "—";
}

const STEP_LABELS = ["Recipients", "Tests & materials", "Timing & submission", "Result disclosure", "Review & send"];

export function InvitationComposerPage() {
  const { t, say } = useStore();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [recipients, setRecipients] = useState<Recipient[]>(() =>
    Object.values(CASES)
      .filter((c) => c.status === "linked")
      .slice(0, 1)
      .map((c) => ({ caseId: c.id, name: candidateName(c.id), email: candidateEmail(c.id) })),
  );
  const [mode, setMode] = useState<"timed" | "deadline_only">("timed");
  const [durationMin, setDurationMin] = useState(90);
  const [deadline] = useState("2026-09-25T23:59:00Z");
  const [disclosure, setDisclosure] = useState<"score_and_summary" | "summary_only">("score_and_summary");
  const [delivery, setDelivery] = useState<DeliveryRow[] | null>(null);

  const allItems = useMemo(() => recipients.flatMap((r) => planItemsForCase(r.caseId)), [recipients]);
  const uniqueQuestions = useMemo(() => {
    const seen = new Set<string>();
    return allItems.filter((pi) => (seen.has(pi.questionId) ? false : (seen.add(pi.questionId), true))).map((pi) => QUESTIONS[pi.questionId]);
  }, [allItems]);

  function removeRecipient(caseId: string) {
    setRecipients((rows) => rows.filter((r) => r.caseId !== caseId));
  }
  function addDemoRecipient() {
    if (recipients.some((r) => r.caseId === "case_priya")) {
      say(t("Priya Kapoor is already in this batch."));
      return;
    }
    setRecipients((rows) => [...rows, { caseId: "case_priya", name: "Priya Kapoor", email: "priya.kapoor@example.com", isNew: true }]);
  }

  function next() {
    if (step === 0 && recipients.length === 0) {
      say(t("Add at least one recipient."), { type: "danger" });
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }
  function saveExit() {
    say(t("Save draft & exit"));
    navigate(`/assessments/${PROJECT.id}`);
  }

  function send() {
    const rows: DeliveryRow[] = recipients.map((r) => ({ ...r, status: r.isNew ? "bounced" : "sent" }));
    setDelivery(rows);
  }

  function retry(caseId: string) {
    setDelivery((rows) => (rows ? rows.map((r) => (r.caseId === caseId ? { ...r, status: "sent" } : r)) : rows));
    say(`Retried ${candidateName(caseId)} only — no duplicate candidate created.`, { type: "success" });
  }

  function done() {
    navigate(`/assessments/${PROJECT.id}`);
  }

  if (delivery) {
    return (
      <div>
        <PageHeader title={t("Invite candidates")} crumbs={[{ label: "Assessments", href: "/assessments" }, { label: "Invite candidates" }]} />
        <Card style={{ maxWidth: 720 }}>
          <h3 style={{ marginBottom: 12 }}>{t("Delivery")}</h3>
          {delivery.map((r) => (
            <div key={r.caseId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div>
                <b>{r.name}</b>
                <div className="tiny">{r.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {r.status === "sent" ? <span className="badge success"><span className="dot" />{t("Sent")}</span> : <span className="badge danger"><span className="dot" />{t("Simulated bounce")}</span>}
                {r.status === "bounced" && <Button size="sm" onClick={() => retry(r.caseId)}>{t("Retry")}</Button>}
              </div>
            </div>
          ))}
          <Button variant="primary" style={{ marginTop: 16 }} onClick={done}>{t("Done")}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("Invite candidates")} crumbs={[{ label: "Assessments", href: "/assessments" }, { label: "Invite candidates" }]} />

      <div className="flex gap-2 wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="chip" style={i === step ? { background: "var(--selected-surface)", color: "var(--accent)", borderColor: "transparent" } : undefined}>
            {i + 1}. {t(label)}
          </div>
        ))}
      </div>

      <Card style={{ maxWidth: 720 }}>
        {step === 0 && (
          <div>
            <h3 style={{ marginBottom: 12 }}>{t("Recipients")}</h3>
            <div style={{ marginBottom: 12 }}>
              {recipients.length === 0 && <div className="tiny">{t("No recipients yet.")}</div>}
              {recipients.map((r) => (
                <div key={r.caseId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <b>{r.name}</b>
                    <div className="tiny">{r.email}{r.isNew ? ` · ${t("newly added to this batch")}` : ""}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeRecipient(r.caseId)}>{t("Remove")}</Button>
                </div>
              ))}
            </div>
            <Button size="sm" onClick={addDemoRecipient}>{t("+ Add Priya Kapoor (demo, new candidate)")}</Button>
            <div className="tiny" style={{ marginTop: 10 }}>{t("Each recipient must already have a confirmed role link (Core Application) before they can appear here.")}</div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 style={{ marginBottom: 12 }}>{t("Tests & materials")}</h3>
            {uniqueQuestions.length === 0 ? (
              <div className="banner warning">{t("No plan items found for these recipients — add a test from the Question Bank on their plan page first.")}</div>
            ) : (
              <>
                {uniqueQuestions.map((q) => (
                  <Card key={q.id} style={{ marginBottom: 8 }}>
                    <b>{q.code}</b> — {q.title} <Chip>v{q.version}</Chip>
                    <div className="tiny">{t("Est.")} {q.estMinutes} min · {t("Materials:")} {q.materials.join(", ") || t("none")}</div>
                  </Card>
                ))}
                <div className="tiny">{t("Estimated candidate workload shown per test; total varies by which tests each recipient's plan includes.")}</div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ marginBottom: 12 }}>{t("Timing & submission")}</h3>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t("Mode")}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant={mode === "timed" ? "primary" : "default"} onClick={() => setMode("timed")}>{t("Timed")}</Button>
                <Button size="sm" variant={mode === "deadline_only" ? "primary" : "default"} onClick={() => setMode("deadline_only")}>{t("Deadline only")}</Button>
              </div>
            </div>
            {mode === "timed" && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label>{t("Duration once started (minutes)")}</label>
                <input className="input" type="number" style={{ maxWidth: 160 }} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value) || 90)} />
              </div>
            )}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t("Deadline")}</label>
              <input className="input" type="datetime-local" defaultValue="2026-09-25T23:59" />
            </div>
            <div className="field">
              <label>{t("Submission channel")}</label>
              <div className="tiny">
                {t("Portal upload (draft until Submit)")} <b>{t("and")}</b> {t("email reply from the verified address to the unified inbox. Complete answers sent from the verified email in the correct thread can be submitted automatically:")}{" "}
                <span className="mono">hr@sendinglabs.com</span> {t("(From/Reply-To — simulated only, no real mail is sent).")}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={{ marginBottom: 12 }}>{t("Result disclosure")}</h3>
            {(["score_and_summary", "summary_only"] as const).map((val) => (
              <label key={val} className="checkbox-row" style={{ marginBottom: 8, cursor: "pointer", display: "flex" }}>
                <input type="radio" name="disc" checked={disclosure === val} onChange={() => setDisclosure(val)} />
                {val === "score_and_summary" ? t("Score + summary") : t("Summary only (no numeric score)")}
              </label>
            ))}
            <div className="tiny" style={{ marginTop: 8 }}>{t("Never includes internal ranking, reviewer notes, or the internal answer key.")}</div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 style={{ marginBottom: 12 }}>{t("Review & send")}</h3>
            <div className="banner info" style={{ marginBottom: 12 }}>
              {t("Preview shown per recipient: template, question package version, estimated workload, timezone")} ({TZ}) {t("and Reply-To.")}
            </div>
            {recipients.map((r) => (
              <Card key={r.caseId} style={{ marginBottom: 8 }}>
                <b>{r.name}</b> · {r.email}
                <div className="tiny">
                  {mode === "timed" ? `${durationMin} ${t("min timed")}` : t("Deadline only")} · {t("Deadline")} {fmtDateShort(deadline)} · {t("Disclosure:")} {disclosure === "score_and_summary" ? t("Score + summary") : t("Summary only")}
                </div>
                <div className="tiny">{t("From / Reply-To:")} hr@sendinglabs.com {t("(simulated)")}</div>
              </Card>
            ))}
            <Button variant="primary" style={{ marginTop: 8 }} onClick={send}>{t("Send invitations (demo)")}</Button>
          </div>
        )}
      </Card>

      <div style={{ display: "flex", gap: 8, marginTop: 16, maxWidth: 720 }}>
        {step > 0 && <Button onClick={back}>{t("Back")}</Button>}
        {step < 4 && <Button variant="primary" onClick={next}>{t("Continue")}</Button>}
        <Button variant="ghost" onClick={saveExit}>{t("Save draft & exit")}</Button>
      </div>
    </div>
  );
}
