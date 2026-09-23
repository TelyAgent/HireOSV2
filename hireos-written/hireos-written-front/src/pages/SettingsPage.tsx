import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Badge, Button, Card, PageHeader } from "../components/ui/Primitives";
import { StatusBadge } from "../utils/status";
import { useStore } from "../store/StoreContext";
import { fmtDateShort } from "../data/fixtures";
import { getUser } from "../data/users";
import type { UserId } from "../store/types";

// Calibration is presentational-only for this first pass — no fixture exists yet for it
// (unlike the rest of this page's real data). Kept local rather than added to
// data/fixtures.ts to avoid destabilizing a shared file other pages already depend on.
const CALIBRATION_LAYERS = [
  { scope: "Organization", status: "active", pointerOnly: true, note: "Follows the Assessment scoring rules in the PRD (fixed) — see the Interface Spec for the current contract version." },
  { scope: "Team rubric — Finance Operations", status: "active", rules: [
    { feature: "FIN-001 competency weights", detail: "Cashbook and evidence matching 25% / Bank reconciliation 30% / Reimbursements and exceptions 20% / Accountant package 15% / Controls and communication 10%", locked: true },
    { feature: "Minimum reviewer coverage before Release", detail: "Every required criterion must have a human score", locked: true },
  ] },
  { scope: "Role default — Reviewer", status: "active", rules: [
    { feature: "Default disclosure policy", detail: "Score + summary", locked: false },
    { feature: "Default submission channel", detail: "Portal upload + verified email", locked: false },
  ] },
  { scope: "Personal — John", status: "active", rules: [
    { feature: "Question Bank default view", detail: "List", locked: false },
  ] },
];
const CALIBRATION_SIGNALS = [
  { feature: "Founder communication weight for FIN-004", direction: "increase", strength: 0.58, source: "4 Interview outcomes (SIA pipeline)", eligibility: "eligible" },
  { feature: "Infer from candidate's protected attributes", direction: "n/a", strength: 0, source: "n/a", eligibility: "prohibited" },
];
const CALIBRATION_VERSIONS = [
  { id: "v1", label: "v1 (current)", activatedAt: "2026-07-01T09:00:00Z", activatedBy: "user_morgan" as UserId },
];

export function SettingsPage() {
  const { t, say } = useStore();
  const [policies, setPolicies] = useState({ portal: true, email: true, releasedSummary: true, manualAcceptance: false });

  return (
    <div>
      <PageHeader
        title={t("Preferences")}
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "Preferences" }]}
        actions={
          <Link className="btn sm" to="/ai-models">
            <Icon name="smart_toy" style={{ fontSize: 16 }} />
            {t("AI Models")}
          </Link>
        }
      />
      <div className="muted" style={{ marginBottom: 16 }}>
        {t("Organization and Team layers govern official scoring. Personal views never change team results. Appearance (theme, accent, text size) lives in the")}{" "}
        <Icon name="palette" style={{ fontSize: 15, verticalAlign: "text-bottom" }} /> {t("icon in the top bar.")}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <b>{t("Team access policy — Startup Team Access")}</b>
          <Badge tone="info">startup_open / 1.0</Badge>
        </div>
        <div className="tiny">
          {t("Any valid, active employee of this workspace can create/edit/publish questions, plan, invite, score/override, finalize/release, revise, supplement, hand off, export and resolve exceptions — HR, Hiring Manager, owner and reviewer fields route notifications and default follow-ups, but they are not access-control gates. There is no approval queue and no dual sign-off; sending or publishing is the acting employee's own confirmation, recorded as performed_by. Base limits still apply: valid company login, candidates see only their own tasks and published results, companies stay isolated, and deactivated accounts cannot act. See Team Tasks on")}{" "}
          <Link to="/tasks">{t("My Tasks")}</Link> {t("to act directly on a colleague's open work.")}
        </div>
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3>Policies</h3>
          <Badge tone="info">Editable</Badge>
        </div>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <label className="checkbox-row"><input type="checkbox" checked={policies.portal} onChange={(e) => setPolicies((p) => ({ ...p, portal: e.target.checked }))} /> Portal upload enabled</label>
          <label className="checkbox-row"><input type="checkbox" checked={policies.email} onChange={(e) => setPolicies((p) => ({ ...p, email: e.target.checked }))} /> Email reply enabled</label>
          <label className="checkbox-row"><input type="checkbox" checked={policies.releasedSummary} onChange={(e) => setPolicies((p) => ({ ...p, releasedSummary: e.target.checked }))} /> Candidate sees released summary</label>
          <label className="checkbox-row"><input type="checkbox" checked={policies.manualAcceptance} onChange={(e) => setPolicies((p) => ({ ...p, manualAcceptance: e.target.checked }))} /> Require manual round acceptance</label>
        </div>
        <Button size="sm" variant="primary" style={{ marginTop: 12 }} onClick={() => say("Assessment policies saved.", { type: "success" })}>Save policies</Button>
      </Card>

      <CalibrationSection />
    </div>
  );
}

function CalibrationSection() {
  const { t, state, say } = useStore();
  const [proposals, setProposals] = useState([
    { id: "prop_fin004_weights", title: "Proposed: raise Founder communication weight for FIN-004 (10%→20%, Risk prioritisation 20%→10%)", basis: "4 completed onsite interviews where a strong written Risk prioritisation score did not predict how well the candidate communicated trade-offs to the founder in person.", sampleSize: 4, window: "Last 60 days" },
  ]);
  const isAdmin = state.currentUser === "user_morgan";

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {CALIBRATION_LAYERS.map((layer) => (
          <Card key={layer.scope}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <b>{layer.scope}</b>
              <StatusBadge status={layer.status} />
            </div>
            {layer.pointerOnly ? (
              <div className="tiny" style={{ marginTop: 8 }}>{layer.note}</div>
            ) : (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "calc(var(--text-base)*.88)" }}>
                {layer.rules?.map((r, i) => (
                  <li key={i}>{r.feature} — {r.detail}{r.locked && <> <Badge tone="neutral">{t("Locked")}</Badge></>}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <h4 style={{ margin: "8px 0 8px" }}>{t("Feedback signals")} <span className="tiny" style={{ fontWeight: 400 }}>({t("from Interview outcomes and human overrides")})</span></h4>
      <div className="table-wrap" style={{ marginBottom: 20 }}>
        <table className="table">
          <thead>
            <tr><th>{t("Feature")}</th><th>{t("Direction")}</th><th>{t("Strength")}</th><th>{t("Source")}</th><th>{t("Eligibility")}</th></tr>
          </thead>
          <tbody>
            {CALIBRATION_SIGNALS.map((s, i) => (
              <tr key={i}>
                <td>{s.feature}</td>
                <td>{s.direction === "n/a" ? "—" : t(s.direction)}</td>
                <td>{s.strength ? `${Math.round(s.strength * 100)}%` : "—"}</td>
                <td className="tiny">{s.source}</td>
                <td>{s.eligibility === "eligible" ? <Badge tone="success">{t("Eligible")}</Badge> : <Badge tone="danger">{t("Prohibited — excluded")}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 style={{ marginBottom: 8 }}>{t("Proposed shared preferences")} <span className="tiny" style={{ fontWeight: 400 }}>({t("pending review — never auto-applied")})</span></h4>
      <Card padded={false} style={{ marginBottom: 20 }}>
        {proposals.length === 0 ? (
          <div className="empty">{t("No proposals pending.")}</div>
        ) : (
          proposals.map((p) => (
            <div key={p.id} className="task-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div className="task-main">
                  <div className="task-title">{p.title}</div>
                  <div className="task-sub">{t("Basis:")} {p.basis}</div>
                  <div className="tiny">{t("Sample size")} {p.sampleSize} · {p.window}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {isAdmin ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => { setProposals((prev) => prev.filter((x) => x.id !== p.id)); say("Proposal rejected — no change to active preferences."); }}>{t("Reject")}</Button>
                    <Button size="sm" variant="primary" onClick={() => { setProposals((prev) => prev.filter((x) => x.id !== p.id)); say("New shared rubric version activated. Already-scored evaluations are unchanged.", { type: "success" }); }}>{t("Activate new version")}</Button>
                  </>
                ) : (
                  <Badge tone="info">{t("Awaiting Admin review")}</Badge>
                )}
              </div>
            </div>
          ))
        )}
      </Card>

      <h4 style={{ marginBottom: 8 }}>{t("Version history")}</h4>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t("Version")}</th><th>{t("Activated")}</th><th>{t("By")}</th><th></th></tr></thead>
          <tbody>
            {CALIBRATION_VERSIONS.map((v) => {
              const isCurrent = v.label.includes("current");
              return (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td className="tiny">{fmtDateShort(v.activatedAt)}</td>
                  <td className="tiny">{getUser(v.activatedBy).name}</td>
                  <td>{!isCurrent && <Button size="sm" variant="ghost" onClick={() => say("Rolled back — a new version was created pointing at the prior configuration.", { type: "success" })}>{t("Roll back to this")}</Button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
