import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { CloseButton, DrawerBody, DrawerFooter, DrawerHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { money } from "../../lib/format";
import type { Requirement } from "../../data/types";

/** Roles entitled to see restricted content in this demo. */
const RESTRICTED_VIEWERS = ["maya", "alex", "sam"];

export function BlueprintDrawer({ jobId }: { jobId: string }) {
  const { state, t, closeModal } = useStore();
  const navigate = useNavigate();
  const job = state.jobs[jobId];
  if (!job) return null;

  const reqs = state.requirements[jobId] ?? [];
  const restr = state.restricted[jobId] ?? [];
  const rv = job.activeRoleVersionRef ? state.roleVersions[job.activeRoleVersionRef] : null;
  const must = reqs.filter((r) => r.priority === "must_have");
  const pref = reqs.filter((r) => r.priority === "preferred");
  const blockers = reqs.filter((r) => r.flagVague || r.conflict);
  const complete = job.activeRoleVersionRef ? 100 : reqs.length ? 55 : 10;
  const canSeeRestricted = RESTRICTED_VIEWERS.includes(state.currentUserId);

  const roleItems = [
    `${job.title} — ${job.department}`,
    `${t("Location")}: ${job.location}`,
    `${t("Headcount")}: ${job.headcount}`,
  ];

  return (
    <>
      <DrawerHeader title={t("Requirements Blueprint")} />
      <DrawerBody>
        <div className="card card-pad" style={{ background: "var(--surface-alt)", border: "none", marginBottom: 18 }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
            <span className="tiny">{t("Completeness")}</span>
            <span className="tiny">{complete}%</span>
          </div>
          <div className="completeness-bar-track">
            <div className="completeness-bar-fill" style={{ width: `${complete}%` }} />
          </div>
          <div className="flex gap-8" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {job.activeRoleVersionRef ? (
              <span className="badge badge-success">{t("Ready for approval")}</span>
            ) : (
              <span className="badge badge-warning">{t("Evaluation setup incomplete")}</span>
            )}
            {blockers.length > 0 ? (
              <span className="badge badge-danger">
                {blockers.length} {t("blocker(s)")}
              </span>
            ) : (
              <span className="badge badge-neutral">0 {t("blockers")}</span>
            )}
          </div>
        </div>

        {blockers.length > 0 && (
          <div className="warning-inline" style={{ marginBottom: 14 }}>
            <Icon name="flag" />
            {blockers.length} {t("item(s) need attention before this can be submitted for approval.")}
          </div>
        )}

        <div className="blueprint-group">
          <h4>{t("Role")}</h4>
          {roleItems.map((stmt) => (
            <div key={stmt} className="req-row">
              <div className="rr-stmt">{stmt}</div>
            </div>
          ))}
        </div>

        {rv && rv.responsibilities.length > 0 && (
          <div className="blueprint-group">
            <h4>{t("Responsibilities")}</h4>
            {rv.responsibilities.map((r) => (
              <div key={r} className="req-row">
                <div className="rr-stmt">{r}</div>
              </div>
            ))}
          </div>
        )}

        <div className="blueprint-group">
          <h4>{t("Must-have")}</h4>
          {must.length ? must.map((r) => <ReqRow key={r.id} req={r} />) : <div className="tiny">{t("None yet.")}</div>}
        </div>
        <div className="blueprint-group">
          <h4>{t("Preferred")}</h4>
          {pref.length ? pref.map((r) => <ReqRow key={r.id} req={r} />) : <div className="tiny">{t("None yet.")}</div>}
        </div>

        <div className="blueprint-group">
          <h4>{t("Compensation")}</h4>
          <div className="req-row">
            <div className="rr-stmt">
              {t("Public range")}: {money(rv?.publicCompensation)}
            </div>
          </div>
          {canSeeRestricted ? (
            <div className="req-row">
              <div className="rr-stmt">
                {t("Internal ceiling")}: {money(rv?.internalCompensation)}{" "}
                <span className="badge badge-warning">{t("Restricted")}</span>
              </div>
            </div>
          ) : (
            <div className="restricted-locked">
              <Icon name="lock" />
              {t("You do not have access to restricted details.")}
            </div>
          )}
        </div>

        {restr.length > 0 && (
          <div className="blueprint-group">
            <h4>{t("Restricted requirement (pending policy review)")}</h4>
            {canSeeRestricted ? (
              restr.map((r) => (
                <div key={r.id} className="restricted-box">
                  <Icon name="flag" />
                  <div>
                    <strong>{t(r.type.replace(/_/g, " "))}</strong> — {r.value}
                    <div className="tiny" style={{ marginTop: 4 }}>
                      {t("Source: uploaded material • Review status: pending • Not used in scoring or public JD.")}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="restricted-locked">
                <Icon name="lock" />
                {t("You do not have access to restricted details.")}
              </div>
            )}
          </div>
        )}

        <div className="blueprint-group">
          <h4>{t("Success in first 90 days")}</h4>
          {rv?.successCriteria?.length ? (
            rv.successCriteria.map((s) => (
              <div key={s.period + s.statement} className="req-row">
                <div className="rr-stmt">
                  <strong>{s.period}:</strong> {s.statement}
                </div>
              </div>
            ))
          ) : (
            <div className="tiny">{t("Not specified.")}</div>
          )}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <CloseButton />
        <Button
          variant="primary"
          onClick={() => {
            closeModal();
            navigate(`/jobs/${jobId}/document`);
          }}
        >
          {t("Go to document")}
        </Button>
      </DrawerFooter>
    </>
  );
}

function ReqRow({ req }: { req: Requirement }) {
  const { t } = useStore();
  return (
    <div className="req-row">
      <div className="rr-top">
        <span className="rr-stmt" style={{ flex: 1 }}>
          {req.statement}
        </span>
        {req.conflict && <span className="badge badge-warning">{t("Conflict")}</span>}
        {req.flagVague && <span className="badge badge-warning">{t("Needs evidence standard")}</span>}
      </div>
      <div className="rr-meta">
        {t("Evidence")}: {req.evidenceStandard || t("Not specified")}
      </div>
    </div>
  );
}
