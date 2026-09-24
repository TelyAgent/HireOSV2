import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { listActivity, listConnections, listFiles, pauseConnection, readNowConnection, reconnectConnection } from "../data/api/files";
import { db, getPerson } from "../data/db";
import type { FileRecord } from "../data/fixtures/files";
import type { Connection, ConnectionKind } from "../data/fixtures/connections";
import type { ActivityEntry } from "../data/fixtures/activity";
import { fmtDate, relTime } from "../lib/format";
import { Badge, PageHeader, UnderlineTabs } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";
import { Drawer } from "../components/ui/Overlays";

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function FilePreviewDrawer({ file, onClose }: { file: FileRecord; onClose: () => void }) {
  const { t } = useStore();
  const linkedName = file.linked.replace(/\s*\([^)]*\)\s*$/, "");
  let candidate = Object.values(db.candidates).find((c) => c.displayName === linkedName);
  if (file.linked.includes("Finance")) {
    candidate = Object.values(db.candidates).find((c) => c.displayName === linkedName && c.tags.includes("Finance")) || candidate;
  }

  return (
    <Drawer open onClose={onClose} title={file.name}>
      {candidate ? (
        <div className="card card-pad" style={{ background: "var(--surface-2)" }}>
          <div className="eyebrow">{t("Extracted resume content")}</div>
          <h2 style={{ margin: "6px 0 2px", fontSize: 20 }}>{candidate.displayName}</h2>
          <div className="tiny">
            {candidate.contact.email} · {candidate.contact.phone} · {candidate.contact.location.value}
          </div>
          <hr className="divider" />
          <h3 className="section-title">{t("Experience")}</h3>
          {candidate.employment.map((job, i) => (
            <section style={{ marginBottom: 16 }} key={i}>
              <div style={{ fontWeight: 700 }}>
                {job.title} · {job.company}
              </div>
              <div className="tiny mono" style={{ margin: "2px 0 6px" }}>
                {job.start} — {job.end}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {job.achievements.map((item, j) => (
                  <li style={{ marginBottom: 4 }} key={j}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <h3 className="section-title">{t("Skills")}</h3>
          <div className="flex gap-6 flex-wrap">
            {candidate.skills.map((skill) => (
              <span className="tag" key={skill}>
                {skill}
              </span>
            ))}
          </div>
          <hr className="divider" />
          <h3 className="section-title">{t("Education")}</h3>
          {candidate.education.map((item, i) => (
            <div key={i}>
              <div>{item.statement}</div>
              <div className="tiny mono">{item.period}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card card-pad" style={{ textAlign: "center", padding: "44px 20px", background: "var(--surface-2)" }}>
          <Icon name="description" size={44} style={{ color: "var(--text-tertiary)" }} />
          <p className="tiny" style={{ marginTop: 10 }}>
            {t("Structured source preview is not available for this file type in the prototype.")}
          </p>
        </div>
      )}
      <table className="data-table" style={{ marginTop: 14 }}>
        <tbody>
          <tr>
            <td className="tiny">{t("Type")}</td>
            <td>{file.type}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Size")}</td>
            <td>{file.sizeKB} KB</td>
          </tr>
          <tr>
            <td className="tiny">{t("Source")}</td>
            <td>{file.source}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Read")}</td>
            <td>{t(cap(file.readStatus))}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Extraction")}</td>
            <td>{t(cap(file.extraction))}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Linked to")}</td>
            <td>{t(file.linked)}</td>
          </tr>
        </tbody>
      </table>
    </Drawer>
  );
}

function FilesTab() {
  const { t, say } = useStore();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [preview, setPreview] = useState<FileRecord | null>(null);

  useEffect(() => {
    listFiles().then(setFiles);
  }, []);

  const download = () => {
    say(t("Preparing download…"));
    setTimeout(() => say(t("File sent to your browser (demo)"), { type: "success" }), 400);
  };

  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <span className="tiny muted">
          {files.length} {t("files")}
        </span>
        <Link className="btn btn-primary" to="/imports/new">
          <Icon name="upload" />
          {t("Upload")}
        </Link>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Name", "Name (file)")}</th>
              <th>{t("Type")}</th>
              <th>{t("Source")}</th>
              <th>{t("Uploaded")}</th>
              <th>{t("Read")}</th>
              <th>{t("Extraction")}</th>
              <th>{t("Security")}</th>
              <th>{t("Linked to")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td>
                  <span className="flex items-center gap-8">
                    <Icon name="description" size={18} style={{ color: "var(--text-tertiary)" }} />
                    {f.name}
                  </span>
                </td>
                <td className="tiny">{f.type}</td>
                <td className="tiny">{f.source}</td>
                <td className="tiny">{fmtDate(f.uploadedAt, "en")}</td>
                <td>{f.readStatus === "available" ? <Badge tone="success">{t("Available")}</Badge> : <Badge tone="outline">{t(cap(f.readStatus))}</Badge>}</td>
                <td>{f.extraction === "complete" ? <Badge tone="success">{t("Complete")}</Badge> : <Badge tone="warning">{t(cap(f.extraction))}</Badge>}</td>
                <td>{f.security === "passed" ? <Badge tone="success">{t("Passed")}</Badge> : <Badge tone="danger">{t(cap(f.security))}</Badge>}</td>
                <td className="tiny">{t(f.linked)}</td>
                <td className="text-right">
                  <button className="btn btn-sm btn-secondary" onClick={() => setPreview(f)}>
                    {t("Preview")}
                  </button>{" "}
                  <button className="btn btn-sm btn-secondary" onClick={download}>
                    {t("Download")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview && <FilePreviewDrawer file={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

const CONN_ICON: Record<ConnectionKind, string> = { email: "mail_outline", folder: "folder_open", api: "api" };
function connStatusBadge(s: Connection["status"], t: (s: string, k?: string) => string) {
  if (s === "connected" || s === "watching") return <Badge tone="success">{t(cap(s))}</Badge>;
  if (s === "authorization_required") return <Badge tone="danger">{t("Authorization required")}</Badge>;
  if (s === "paused") return <Badge tone="warning">{t("Paused")}</Badge>;
  return <Badge tone="outline">{t(cap(s))}</Badge>;
}

function ConnectionsTab() {
  const { t } = useStore();
  const [rows, setRows] = useState<Connection[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => listConnections().then(setRows);
  useEffect(() => {
    load();
  }, []);

  const act = async (fn: (id: string) => Promise<unknown>, id: string) => {
    setBusy(id);
    await fn(id);
    setBusy(null);
    load();
  };

  return (
    <div className="card">
      {rows.map((c) => (
        <div className="list-row" style={{ padding: "14px 16px" }} key={c.id}>
          <Icon name={CONN_ICON[c.kind]} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            <div className="tiny">
              {c.account} · {c.scope} · {t("Last read")} {relTime(c.lastRead, "en")}
            </div>
          </div>
          {connStatusBadge(c.status, t)}
          {c.status === "authorization_required" ? (
            <button className="btn btn-sm btn-secondary" disabled={busy === c.id} onClick={() => act(reconnectConnection, c.id)}>
              {t("Reconnect")}
            </button>
          ) : (
            <>
              <button className="btn btn-sm btn-secondary" disabled={busy === c.id} onClick={() => act(readNowConnection, c.id)}>
                {t("Read now")}
              </button>
              <button className="btn btn-sm btn-secondary" disabled={busy === c.id} onClick={() => act(pauseConnection, c.id)}>
                {t("Pause")}
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ActivityTab() {
  const { t } = useStore();
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    listActivity().then(setRows);
  }, []);

  return (
    <div className="card">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("Operation")}</th>
            <th>{t("Actor")}</th>
            <th>{t("Target")}</th>
            <th>{t("Status")}</th>
            <th>{t("When")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.op}</td>
              <td className="tiny">{getPerson(a.actor)?.name || a.actor}</td>
              <td className="tiny">{a.target}</td>
              <td>
                {a.status === "succeeded" ? (
                  <Badge tone="success">{t("Succeeded")}</Badge>
                ) : a.status === "partial" ? (
                  <Badge tone="warning">{t("Partially succeeded")}</Badge>
                ) : (
                  <Badge tone="danger">{t("Failed")}</Badge>
                )}
                {a.detail && <span className="tiny"> ({a.detail})</span>}
              </td>
              <td className="tiny">{relTime(a.at, "en")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type FilesTabKey = "files" | "connections" | "activity";

export function FilesPage() {
  const { t } = useStore();
  const [tab, setTab] = useState<FilesTabKey>("files");

  return (
    <>
      <PageHeader
        title={t("Files & Integrations")}
        subtitle={t("Where material comes from, whether it was read successfully, and what happened to it — independent of any one candidate or job.")}
        crumbs={[{ label: t("Files & Integrations") }]}
      />
      <UnderlineTabs
        tabs={[
          { key: "files", label: t("Files") },
          { key: "connections", label: t("Connections") },
          { key: "activity", label: t("Activity") },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "files" && <FilesTab />}
      {tab === "connections" && <ConnectionsTab />}
      {tab === "activity" && <ActivityTab />}
    </>
  );
}
