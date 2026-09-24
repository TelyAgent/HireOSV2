import { useState } from "react";
import { Button } from "../../components/ui/Primitives";
import { CloseButton, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { getPerson } from "../../data/fixtures/people";
import { fmtDate } from "../../lib/format";

const HISTORY_TABS = ["Requirements", "Internal JD", "External JD"];

export function VersionHistoryModal({ jobId }: { jobId: string }) {
  const { state, t, say, closeModal } = useStore();
  const [tab, setTab] = useState(HISTORY_TABS[0]);
  const job = state.jobs[jobId];
  const versions = Object.values(state.roleVersions)
    .filter((v) => v.jobId === jobId)
    .sort((a, b) => b.versionNo - a.versionNo);

  return (
    <>
      <ModalHeader title={t("Version history")} />
      <ModalBody>
        <div className="underline-tabs">
          {HISTORY_TABS.map((x) => (
            <div key={x} className={`u-tab${tab === x ? " active" : ""}`} onClick={() => setTab(x)}>
              {t(x)}
            </div>
          ))}
        </div>
        {versions.length === 0 ? (
          <div className="tiny">{t("No versions yet.")}</div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="list-row">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  v{v.versionNo}{" "}
                  {v.id === job.activeRoleVersionRef ? (
                    <span className="badge badge-success">{t("Active")}</span>
                  ) : (
                    <span className="badge badge-neutral">{t(v.status, `roleVersion.${v.status}`)}</span>
                  )}
                </div>
                <div className="tiny">
                  {t("Confirmed by")} {getPerson(v.confirmedBy)?.name} • {fmtDate(v.confirmedAt)}
                </div>
              </div>
              <Button variant="text" size="sm" onClick={() => say(t("Opening read-only history view (demo)"))}>
                {t("View")}
              </Button>
              {v.id !== job.activeRoleVersionRef && (
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => {
                    closeModal();
                    say(t("Restored as a new draft — does not change the active standard"));
                  }}
                >
                  {t("Restore as new draft")}
                </Button>
              )}
            </div>
          ))
        )}
      </ModalBody>
      <ModalFooter>
        <CloseButton />
      </ModalFooter>
    </>
  );
}
