import { Icon } from "../../components/ui/Icons";
import { EmptyState } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { getPerson } from "../../data/fixtures/people";
import { fmtDateTime } from "../../lib/format";

export function ActivityTab({ jobId }: { jobId: string }) {
  const { state, t } = useStore();
  const items = state.activity[jobId] ?? [];

  return (
    <div className="main-inner" style={{ padding: "24px 28px 64px" }}>
      <div className="page-header">
        <div>
          <h2 className="section-title">{t("Activity")}</h2>
          <p className="tiny">{t("Every human, AI and system fact for this job, in order.")}</p>
        </div>
      </div>
      <div className="card card-pad">
        {items.length === 0 ? (
          <EmptyState icon="history" title={t("No activity yet")} />
        ) : (
          items.map((it, i) => (
            <div key={i} className="timeline-item">
              <div className="ti-icon">
                <Icon name={it.actor === "ai" ? "auto_awesome" : it.actor === "system" ? "dns" : "person"} />
              </div>
              <div className="ti-body">
                <div className="ti-title">
                  {it.actor === "system" ? t("System") : (getPerson(it.actor)?.name ?? it.actor)}
                  {it.tag && <span className="badge badge-ai">{it.tag}</span>} — {it.text}
                </div>
                <div className="ti-meta">{fmtDateTime(it.at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
