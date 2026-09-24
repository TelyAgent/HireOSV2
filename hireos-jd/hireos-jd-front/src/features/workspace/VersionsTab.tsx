import { Button, StatusBadge } from "../../components/ui/Primitives";
import { CancelButton, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { IMPACT } from "../../data/fixtures/approvals";
import { fmtDate, fmtRelative } from "../../lib/format";

export function VersionsTab({ jobId }: { jobId: string }) {
  const { state, t, openModal } = useStore();
  const job = state.jobs[jobId];
  const impact = IMPACT[jobId];
  const versions = Object.values(state.roleVersions)
    .filter((v) => v.jobId === jobId)
    .sort((a, b) => b.versionNo - a.versionNo);

  return (
    <div className="main-inner" style={{ padding: "24px 28px 64px" }}>
      <div className="page-header">
        <div>
          <h2 className="section-title">{t("Versions & Impact")}</h2>
          <p className="tiny">
            {t("Requirements, Internal JD and External JD versions, and downstream impact when standards change.")}
          </p>
        </div>
      </div>
      <div className="two-col">
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t("Requirement versions")}
          </div>
          {versions.length === 0 ? (
            <div className="tiny">{t("No versions yet.")}</div>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="list-row">
                <span style={{ flex: 1 }}>
                  v{v.versionNo}
                  {v.id === job.activeRoleVersionRef ? ` — ${t("Active")}` : ""}
                </span>
                <span className="tiny">{fmtDate(v.confirmedAt)}</span>
              </div>
            ))
          )}
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t("Downstream impact")}{" "}
            {!impact && <StatusBadge kind="connection_status" value="not_connected" />}
          </div>
          {impact ? (
            <>
              <div className="list-row">
                <span style={{ flex: 1 }}>{t("Screening")}</span>
                <span>{impact.screening.count != null ? `${impact.screening.count} ${t("candidates")}` : t("Unavailable")}</span>
                <span className="tiny">
                  {t("as of")} {fmtRelative(impact.screening.asOf)}
                </span>
              </div>
              <div className="list-row">
                <span style={{ flex: 1 }}>{t("Assessment")}</span>
                <span>{impact.assessment.count != null ? `${impact.assessment.count} ${t("candidates")}` : t("Unavailable")}</span>
                <span className="tiny">
                  {t("as of")} {fmtRelative(impact.assessment.asOf)}
                </span>
              </div>
              <div className="list-row">
                <span style={{ flex: 1 }}>{t("Interview")}</span>
                <span className="tiny">
                  {impact.interview.availability === "unavailable" ? t("Not connected") : impact.interview.count}
                </span>
              </div>
              <div className="tiny" style={{ marginTop: 8 }}>
                {t("Counts are independent per module and are not summed into a single candidate total.")}
              </div>
              <Button size="sm" style={{ marginTop: 10 }} onClick={() => openModal(<ImpactDecisionModal />, { wide: true })}>
                {t("Request re-evaluation")}
              </Button>
            </>
          ) : (
            <div className="tiny">{t("This job has no downstream modules installed in this demo.")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactDecisionModal() {
  const { t, say, closeModal } = useStore();
  const options = [
    {
      key: "new",
      title: "Use for new evaluations",
      body: "New evaluations use the new standard; anything already started keeps its old snapshot.",
    },
    {
      key: "reeval",
      title: "Request re-evaluation",
      body: "Ask a specific scope of already-evaluated candidates to be re-assessed against the new standard.",
    },
    {
      key: "keep",
      title: "Keep existing evaluations",
      body: "Do not request re-evaluation; historical results remain as-is.",
    },
  ];
  return (
    <>
      <ModalHeader title={t("Downstream impact decision")} />
      <ModalBody>
        <p className="tiny" style={{ marginBottom: 10 }}>
          {t("Role v3 → v4 changed 2 requirements. Choose how downstream modules should treat this change.")}
        </p>
        {options.map((o, i) => (
          <label key={o.key} className={`radio-card${i === 0 ? " selected" : ""}`} style={{ marginBottom: 8 }}>
            <input type="radio" name="impact" defaultChecked={i === 0} />
            <div>
              <strong>{t(o.title)}</strong>
              <div className="tiny">{t(o.body)}</div>
            </div>
          </label>
        ))}
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button
          variant="primary"
          onClick={() => {
            closeModal();
            say(t("Impact decision recorded"), { type: "success" });
          }}
        >
          {t("Confirm decision")}
        </Button>
      </ModalFooter>
    </>
  );
}
