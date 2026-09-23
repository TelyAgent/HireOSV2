import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal, Input } from "antd";
import { useStore } from "../store/StoreContext";
import { PageHeader, Button, EmptyState } from "../components/ui/Primitives";
import { getUser } from "../data/users";
import {
  CASES, CORE_CANDIDATES, EVALUATIONS, INVITATIONS, RESULTS, RELEASES,
  fmtDate, type Release,
} from "../data/fixtures";
import type { UserId } from "../store/types";

export function ReleasePage() {
  const { id: caseId = "" } = useParams();
  const { t, say } = useStore();
  const navigate = useNavigate();

  const c = CASES[caseId];
  const result = useMemo(() => Object.values(RESULTS).find((r) => r.caseId === caseId), [caseId]);
  const [release, setRelease] = useState<Release | undefined>(() => Object.values(RELEASES).find((r) => r.caseId === caseId));
  const [chk1, setChk1] = useState(false);
  const [chk2, setChk2] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionHint, setRevisionHint] = useState("Please revisit the variance analysis section with more detail on the root cause.");
  const [nextAction, setNextAction] = useState<string | null>(null);

  if (!c || !result) return <EmptyState title="No finalized result for this case yet." />;

  const cand = CORE_CANDIDATES[c.candidateId];
  const evaluation = EVALUATIONS[result.evaluationId];
  const inv = Object.values(INVITATIONS).find((i) => i.caseId === caseId);
  const disclosure = inv ? inv.disclosurePolicy : "score_and_summary";

  function publish() {
    if (!chk1 || !chk2) {
      say("Both review and disclosure approval are required to publish.", { type: "danger" });
      return;
    }
    const rel: Release = {
      id: `rel_${caseId}`, caseId, overall: result!.overall, showScore: disclosure === "score_and_summary",
      outcomeText: result!.overall >= 65 ? "Strong performance on this assessment." : "This assessment did not meet the bar for this role.",
      feedbackText: "Clear structure; accounting treatment mostly correct with one gap in variance analysis.",
      nextStepText: "HR will follow up with next steps.", publishedAt: new Date().toISOString(),
    };
    setRelease(rel);
    say("Result finalized and published. Candidate portal and notification queued.", { type: "success" });
  }

  function requestRevision() {
    setNextAction("revision");
    setRevisionOpen(false);
    say("Revision round 1 created with a new invitation and candidate thread.", { type: "success" });
  }

  return (
    <div>
      <PageHeader title={`${cand.name} — ${t("Release")}`} crumbs={[{ label: "Assessments", href: "/assessments" }, { label: cand.name }]} />

      <div className="two-col">
        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Internal reference")}</h4>
          <div className="tiny" style={{ marginBottom: 8 }}>{t("Overall (human)")}: <b>{result.overall}</b></div>
          {evaluation.criteria.map((cr) => (
            <div key={cr.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span>{cr.name}</span>
              <span>{cr.human}/{cr.max}{cr.overridden ? <span className="tiny"> ({t("overridden")})</span> : null}</span>
            </div>
          ))}
          <div className="tiny" style={{ marginTop: 8 }}>
            {t("Finalized by")} {evaluation.finalizedBy ? getUser(evaluation.finalizedBy as UserId)?.name : "—"} · {fmtDate(evaluation.finalizedAt)}
          </div>
        </div>

        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Candidate preview")}</h4>
          <div className="tiny" style={{ marginBottom: 8 }}>{t("Disclosure policy:")} {disclosure === "score_and_summary" ? t("Score + summary") : t("Summary only")}</div>
          <div className="card card-pad" style={{ background: "var(--canvas)" }}>
            <b>{t("Outcome:")}</b> {result.overall >= 65 ? t("Strong performance on this assessment.") : t("Below the bar for this role on this assessment.")}<br />
            {disclosure === "score_and_summary" && <><b>{t("Score:")}</b> {result.overall}<br /></>}
            <b>{t("Feedback:")}</b> {t("Clear structure; accounting treatment mostly correct with one gap in variance analysis.")}<br />
            <b>{t("Next step:")}</b> {t("HR will follow up with next steps.")}
          </div>
          <div className="tiny" style={{ marginTop: 8 }}>{t("Never includes: internal ranking, reviewer notes, or the internal answer key.")}</div>
        </div>
      </div>

      {!release ? (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>{t("Approve & publish")}</h4>
          <label className="checkbox-row" style={{ marginBottom: 6, display: "flex" }}>
            <input type="checkbox" checked={chk1} onChange={(e) => setChk1(e.target.checked)} /> {t("Internal review complete")}
          </label>
          <label className="checkbox-row" style={{ marginBottom: 12, display: "flex" }}>
            <input type="checkbox" checked={chk2} onChange={(e) => setChk2(e.target.checked)} /> {t("Disclosure content approved for release")}
          </label>
          <Button variant="primary" onClick={publish}>{t("Finalize & publish result")}</Button>
        </div>
      ) : (
        <>
          <div className="banner success" style={{ marginTop: 16 }}>
            {t("Published")} {fmtDate(release.publishedAt)}. {t("Delivery does not guarantee delivery — a bounce would still leave the result visible internally.")}
          </div>
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 8 }}>{t("Next action")}</h4>
            <div className="tiny" style={{ marginBottom: 12 }}>{t("A proposal is prepared first; sending only happens after approval — sorting or comparing candidates never triggers a send.")}</div>
            <div className="flex gap-2 wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button disabled={!!nextAction} onClick={() => setRevisionOpen(true)}>{t("Request revision")}</Button>
              <Button onClick={() => say("Question picker opened (demo).")}>{t("Add supplemental test")}</Button>
              <Button onClick={() => navigate(`/deliveries/del_${caseId}`)}>{t("Prepare Interview handoff")}</Button>
              <Button variant="ghost" onClick={() => say("Case placed on hold (demo).")}>{t("Hold")}</Button>
              <Button variant="ghost" onClick={() => say("Testing closed for this case (demo).")}>{t("Close testing")}</Button>
            </div>
            {nextAction === "revision" && (
              <div className="banner info" style={{ marginTop: 12 }}>
                {t("Revision round")} 1 {t("requested — candidate has been notified.")}{" "}
                <a style={{ cursor: "pointer" }} onClick={() => navigate(`/cases/${caseId}/revisions/1`)}>{t("Open revision workspace →")}</a>
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={revisionOpen} onCancel={() => setRevisionOpen(false)} onOk={requestRevision} title={t("Request revision")} okText={t("Send revision request (demo)")}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t("Feedback shown to candidate")}</label>
          <Input.TextArea rows={3} value={revisionHint} onChange={(e) => setRevisionHint(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("New deadline")}</label>
          <input className="input" type="datetime-local" defaultValue="2026-09-20T23:59" />
        </div>
        <div className="tiny" style={{ marginTop: 8 }}>{t("The prior round stays locked and visible; this creates a new round with its own invitation and thread.")}</div>
      </Modal>
    </div>
  );
}
