import { Icon } from "../../components/ui/Icons";
import { Button, EmptyState, StatusBadge } from "../../components/ui/Primitives";
import { CancelButton, ConfirmDialog, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { fmtRelative, nowISO, uid } from "../../lib/format";

export function PublicationTab({ jobId }: { jobId: string }) {
  const { state, t, mutate, say, openModal } = useStore();
  const pubs = state.publications[jobId] ?? [];

  const withdraw = (pubId: string) => {
    mutate((draft) => {
      const p = draft.publications[jobId]?.find((x) => x.id === pubId);
      if (p) p.status = "withdrawal_pending";
    });
    say(t("Withdrawal requested"));
  };

  const checkStatus = (pubId: string) => {
    say(t("Checking channel status…"));
    setTimeout(() => {
      mutate((draft) => {
        const p = draft.publications[jobId]?.find((x) => x.id === pubId);
        if (p) {
          p.status = "withdrawn";
          p.withdrawnAt = nowISO();
        }
      });
      say(t("Confirmed withdrawn"), { type: "success" });
    }, 700);
  };

  return (
    <div className="main-inner" style={{ padding: "24px 28px 64px" }}>
      <div className="page-header">
        <div>
          <h2 className="section-title">{t("Publication")}</h2>
          <p className="tiny">{t("External JD channels for this job.")}</p>
        </div>
        <Button variant="primary" onClick={() => openModal(<PublishModal jobId={jobId} />)}>
          <Icon name="public" />
          {t("Publish")}
        </Button>
      </div>

      {pubs.length === 0 ? (
        <EmptyState
          icon="public_off"
          title={t("Not published")}
          body={t("No external channels have been published for this job yet.")}
        />
      ) : (
        pubs.map((p) => (
          <div key={p.id} className="channel-row">
            <div className="ch-icon">
              <Icon name={p.channel === "LinkedIn Jobs" ? "business_center" : "language"} />
            </div>
            <div className="ch-body">
              <div className="ch-title">{p.channel}</div>
              <div className="ch-meta">
                {p.versionRef}
                {p.publishedAt ? ` • ${t("Published")} ${fmtRelative(p.publishedAt)}` : ""}
              </div>
            </div>
            <StatusBadge kind="publication_status" value={p.status} />
            <div className="flex gap-6">
              {p.url && (
                <Button variant="text" size="sm" onClick={() => say(t("Opening public preview (demo)"))}>
                  {t("Preview")}
                </Button>
              )}
              {p.status === "published" && (
                <Button
                  size="sm"
                  onClick={() =>
                    openModal(
                      <ConfirmDialog
                        title={t("Withdraw from channel")}
                        body={t(
                          "This requests withdrawal from the channel. It may take time to confirm — status will show as Withdrawal pending until confirmed.",
                        )}
                        confirmLabel={t("Withdraw")}
                        danger
                        onConfirm={() => withdraw(p.id)}
                      />,
                    )
                  }
                >
                  {t("Withdraw")}
                </Button>
              )}
              {p.status === "withdrawal_pending" && (
                <Button size="sm" onClick={() => checkStatus(p.id)}>
                  {t("Check status")}
                </Button>
              )}
              {p.status === "outcome_unknown" && (
                <Button size="sm" onClick={() => checkStatus(p.id)}>
                  {t("Check delivery status")}
                </Button>
              )}
            </div>
          </div>
        ))
      )}

      <div className="section-block" style={{ marginTop: 24 }}>
        <div className="section-title">{t("Email delivery")}</div>
        <div className="card card-pad">
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontWeight: 500 }}>{t("Send offer/agency notification")}</div>
              <div className="tiny">{t("Draft an email with the approved External JD attached.")}</div>
            </div>
            <Button onClick={() => openModal(<EmailDraftModal jobId={jobId} />)}>{t("Draft email")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishModal({ jobId }: { jobId: string }) {
  const { state, t, mutate, say, closeModal } = useStore();
  const job = state.jobs[jobId];
  const activeVer = job.activeRoleVersionRef ? state.roleVersions[job.activeRoleVersionRef] : null;

  if (!activeVer) {
    return (
      <>
        <ModalHeader title={t("Publish External JD")} />
        <ModalBody>
          <div className="warning-inline">
            <Icon name="warning" />
            {t("No confirmed standard to publish yet.")}
          </div>
        </ModalBody>
        <ModalFooter>
          <CancelButton />
        </ModalFooter>
      </>
    );
  }

  const confirmPublish = () => {
    closeModal();
    mutate((draft) => void (draft.jobs[jobId].publicationStatus = "publishing"));
    setTimeout(() => {
      mutate((draft) => {
        draft.publications[jobId] = [
          ...(draft.publications[jobId] ?? []),
          {
            id: uid("pub"),
            channel: "Careers site",
            status: "published",
            publishedAt: nowISO(),
            versionRef: "ExternalJD v2",
            url: "https://careers.sendinglabs.com/jobs/demo",
          },
        ];
        draft.jobs[jobId].publicationStatus = "published";
        (draft.activity[jobId] = draft.activity[jobId] || []).unshift({
          at: nowISO(),
          actor: draft.currentUserId,
          text: "Published ExternalJD to Careers site.",
        });
      });
      say(t("Published"), { type: "success" });
    }, 900);
  };

  return (
    <>
      <ModalHeader title={t("Publish External JD")} />
      <ModalBody>
        <div className="field">
          <label>{t("External JD version")}</label>
          <div className="tiny">
            v2 • {t("Reviewed")} • {t("Source")}: {t("role")} v{activeVer.versionNo}
          </div>
        </div>
        <div className="field">
          <label>{t("Channels")}</label>
          <div className="checkbox-row">
            <input type="checkbox" defaultChecked id="ch-careers" />
            <label htmlFor="ch-careers" style={{ margin: 0, textTransform: "none" }}>
              {t("Careers site")}
            </label>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="ch-linkedin" />
            <label htmlFor="ch-linkedin" style={{ margin: 0, textTransform: "none" }}>
              LinkedIn Jobs
            </label>
          </div>
        </div>
        <div className="info-inline">
          <Icon name="visibility" />
          {t("Public preview shown below excludes internal compensation, restricted content and reviewer notes.")}
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" onClick={confirmPublish}>
          {t("Confirm & publish")}
        </Button>
      </ModalFooter>
    </>
  );
}

function EmailDraftModal({ jobId }: { jobId: string }) {
  const { state, t, say, closeModal } = useStore();
  const job = state.jobs[jobId];
  return (
    <>
      <ModalHeader title={t("Email draft")} />
      <ModalBody>
        <div className="field">
          <label>{t("From")}</label>
          <div className="tiny">HR@sendinglabs.com</div>
        </div>
        <div className="field">
          <label>{t("To")}</label>
          <input type="text" defaultValue="agency-partner@example.com" />
        </div>
        <div className="field">
          <label>{t("Subject")}</label>
          <input type="text" defaultValue={`${job.title} — External JD`} />
        </div>
        <div className="field">
          <label>{t("Attachments")}</label>
          <div className="tag">ExternalJD v2.pdf</div>
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button
          variant="primary"
          onClick={() => {
            closeModal();
            say(t("Email sent (simulated) — delivery status will appear in Activity"), { type: "success" });
          }}
        >
          {t("Send")}
        </Button>
      </ModalFooter>
    </>
  );
}
