import { useStore } from "../store/StoreContext";
import { FILE_ACTIVITY_DEFAULTS, FILE_TABLE_DEFAULTS } from "../data/i18n";
import { Chip, SecondaryButton } from "../components/ui/Primitives";
import { UploadSvg, FolderSvg, MailSvg, CheckSvg, CloseSvg } from "../components/ui/Icons";

export function FilesPage() {
  const { state, t, set, say } = useStore();

  const tabs = [
    { k: "files", label: t.tabFiles },
    { k: "connections", label: t.tabConnections },
    { k: "activity", label: t.tabActivity },
  ] as const;

  const fileRows = FILE_TABLE_DEFAULTS.map((f) => {
    const dupResolved = state.dupResolved;
    const triResolved = state.triResolved;
    return {
      ...f,
      hasAction: f.actionKey === "resolveDup" ? !dupResolved : f.actionKey === "resolveTri" ? !triResolved : false,
      bizStatus:
        f.actionKey === "resolveDup"
          ? dupResolved
            ? "Superseded by v2"
            : "Duplicate · needs resolution"
          : f.actionKey === "resolveTri"
            ? triResolved
              ? "Matched · Screening package"
              : "Unassigned · needs triage"
            : f.biz === "linked" && f.name === "Screening_Report_v2.docx" && !dupResolved
              ? "Pending duplicate resolution"
              : f.bizStatus,
    };
  }).concat(state.uploadedFiles);

  const startUpload = () => {
    set({
      uploadVisible: true,
      uploadBatch: [
        { name: "Screening_Report_v3.docx", status: "success" },
        { name: "Candidate_Work_Sample.pdf", status: "success" },
        { name: "notes.exe", status: "failed", reason: "Unsupported file type" },
      ],
      uploadedFiles: state.uploadedFiles.concat([
        {
          tag: "SCR",
          name: "Screening_Report_v3.docx",
          source: "Manual upload",
          updated: "Just now",
          readStatus: "Available",
          biz: "unassigned",
          bizStatus: "Unassigned · needs triage",
        },
        {
          tag: "WS",
          name: "Candidate_Work_Sample.pdf",
          source: "Manual upload",
          updated: "Just now",
          readStatus: "Available",
          biz: "unassigned",
          bizStatus: "Unassigned · needs triage",
        },
      ]),
      toast: "Upload batch complete: 2 succeeded, 1 failed. Open the batch panel to retry the failed item.",
    });
  };

  return (
    <div
      style={{
        width: "100%",
        padding: "28px 32px 60px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div>
        <div role="heading" aria-level={2} style={{ fontSize: 22, fontWeight: 700 }}>
          {t.filesTitle}
        </div>
        <div style={{ marginTop: 5, fontSize: 13, color: "var(--ink-2)" }}>
          {t.filesSubtitle}
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--line)" }}>
        {tabs.map((tb) => {
          const active = state.filesTab === tb.k;
          return (
            <button
              key={tb.k}
              onClick={() => set({ filesTab: tb.k })}
              style={{
                height: 38,
                padding: "0 14px",
                border: 0,
                borderBottom: `2px solid ${active ? "var(--brand)" : "transparent"}`,
                background: "transparent",
                color: active ? "var(--brand)" : "var(--ink-2)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tb.label}
            </button>
          );
        })}
      </div>

      {state.filesTab === "files" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={startUpload}
              style={{
                height: 36,
                padding: "0 14px",
                border: "1px solid var(--brand)",
                borderRadius: 10,
                background: "var(--brand)",
                color: "var(--brand-ink)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <UploadSvg />
              {t.upload}
            </button>
            <div
              style={{
                flex: 1,
                minWidth: 200,
                padding: "9px 13px",
                border: "1px dashed var(--line-strong)",
                borderRadius: 10,
                color: "var(--ink-3)",
                fontSize: 12,
              }}
            >
              {t.dragHint}
            </div>
          </div>

          {state.uploadVisible && (
            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 14,
                background: "var(--surface)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>
                  {t.uploadProgress} · {state.uploadBatch.filter((u) => u.status === "success").length}{" "}
                  succeeded, {state.uploadBatch.filter((u) => u.status === "failed").length} failed
                </div>
                <button
                  onClick={() => set({ uploadVisible: false })}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "var(--ink-3)",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {t.close}
                </button>
              </div>
              {state.uploadBatch.map((u, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>{u.name}</div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 22,
                      padding: "0 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      background:
                        u.status === "success" ? "var(--ok-soft)" : "var(--bad-soft)",
                      color: u.status === "success" ? "var(--ok)" : "var(--bad)",
                    }}
                  >
                    {u.status === "success"
                      ? "Available"
                      : `Failed · ${u.reason}`}
                  </div>
                  {u.status === "failed" && (
                    <button
                      onClick={() => {
                        const next = state.uploadBatch.map((x, idx) =>
                          idx === i ? { name: "notes.txt", status: "success" } : x,
                        );
                        set({
                          uploadBatch: next,
                          uploadedFiles: state.uploadedFiles.concat([
                            {
                              tag: "TXT",
                              name: "notes.txt",
                              source: "Retry upload",
                              updated: "Just now",
                              readStatus: "Available",
                              biz: "unassigned",
                              bizStatus: "Unassigned · needs triage",
                            },
                          ]),
                        });
                        say(
                          "Failed item re-exported as notes.txt and uploaded successfully. The original failed attempt remains in Activity.",
                        );
                      }}
                      style={{
                        height: 26,
                        padding: "0 10px",
                        border: "1px solid var(--line-strong)",
                        borderRadius: 8,
                        background: "var(--surface)",
                        fontSize: 11.5,
                        cursor: "pointer",
                      }}
                    >
                      {t.retryButton}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            role="table"
            aria-label={t.filesTable}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "11px 16px",
                borderBottom: "1px solid var(--line)",
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1.2fr",
                gap: 10,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10.5,
                letterSpacing: ".05em",
                color: "var(--ink-3)",
              }}
            >
              <div>{t.colName}</div>
              <div>{t.colSource}</div>
              <div>{t.colUpdated}</div>
              <div>{t.colReadStatus}</div>
              <div>{t.colBizStatus}</div>
            </div>
            {fileRows.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1.2fr",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      flex: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      height: 19,
                      padding: "0 6px",
                      borderRadius: 5,
                      background: "var(--surface-3)",
                      color: "var(--ink-2)",
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 9.5,
                    }}
                  >
                    {f.tag}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.name}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{f.source}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{f.updated}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    whiteSpace: "nowrap",
                    color:
                      f.readStatus === "Available" ? "var(--ok)" : "var(--ink-3)",
                  }}
                >
                  {f.readStatus}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color:
                        f.biz === "dup" || f.biz === "unassigned"
                          ? "var(--warn)"
                          : f.biz === "none"
                            ? "var(--ink-3)"
                            : "var(--ink-2)",
                    }}
                  >
                    {f.bizStatus}
                  </div>
                  {f.hasAction && (
                    <button
                      onClick={() => {
                        if (f.actionKey === "resolveDup") {
                          set({ dupResolved: true });
                          say(
                            "Kept Screening_Report_v2.docx as current; v1 stays on record as superseded, not deleted.",
                          );
                        } else if (f.actionKey === "resolveTri") {
                          set({ triResolved: true });
                          say(
                            "Matched to the Screening package. Unmatched attachments never silently become evidence.",
                          );
                        }
                      }}
                      style={{
                        height: 26,
                        padding: "0 9px",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        background: "var(--surface)",
                        fontSize: 11.5,
                        color: "var(--ink-2)",
                        cursor: "pointer",
                      }}
                    >
                      {f.actionLabel}
                    </button>
                  )}
                  <button
                    onClick={() => set({ drawer: "file:" + f.name })}
                    style={{
                      height: 26,
                      padding: "0 9px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      background: "var(--surface)",
                      fontSize: 11.5,
                      color: "var(--ink-2)",
                      cursor: "pointer",
                    }}
                  >
                    {t.details}
                  </button>
                </div>
              </div>
            ))}
            <div
              style={{
                padding: "10px 16px",
                fontSize: 11.5,
                color: "var(--ink-3)",
              }}
            >
              {t.unassignedFoot}
            </div>
          </div>
        </>
      )}

      {state.filesTab === "connections" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
              gap: 16,
            }}
          >
            <ConnectionCard
              title={t.emailConnection}
              icon={<MailSvg />}
              statusLabel={
                state.emailStatus === "connected"
                  ? "Watching"
                  : state.emailStatus === "paused"
                    ? "Paused"
                    : "Authorization required"
              }
              statusTone={
                state.emailStatus === "connected"
                  ? "ok"
                  : state.emailStatus === "paused"
                    ? "neutral"
                    : "warn"
              }
              rule={t.emailRuleDesc}
              last={
                state.emailStatus === "auth_required"
                  ? "Paused since authorization expired — no new mail is being read."
                  : `Last read ${state.emailLastReadAt} · next automatic read in ~15 min (simulated)`
              }
              actions={
                <>
                  <button
                    onClick={() => {
                      if (state.emailStatus !== "connected") {
                        say("Reconnect the email source before reading.");
                        return;
                      }
                      set({ emailLastReadAt: "9 Sep 2026, just now" });
                      say(
                        "Read now (simulated): 1 message matched, 2 attachments extracted, 1 message skipped (no match) — recorded either way.",
                      );
                    }}
                    style={primaryBtn}
                  >
                    {t.readNow}
                  </button>
                  <button
                    onClick={() => {
                      const n = state.emailStatus === "paused" ? "connected" : "paused";
                      set({ emailStatus: n });
                      say(
                        n === "paused"
                          ? "Email reading paused. Already-received materials are unaffected."
                          : "Email reading resumed from the last checkpoint.",
                      );
                    }}
                    style={secondaryBtn}
                  >
                    {state.emailStatus === "paused" ? "Resume" : "Pause"}
                  </button>
                  {state.emailStatus === "auth_required" && (
                    <button
                      onClick={() => {
                        set({ emailStatus: "connected" });
                        say(
                          "Reauthorized. Reading resumes from the last checkpoint — no history is re-scanned unnecessarily.",
                        );
                      }}
                      style={warnBtn}
                    >
                      {t.reauthorize}
                    </button>
                  )}
                  {state.emailStatus === "connected" && (
                    <button
                      onClick={() => {
                        set({ emailStatus: "auth_required" });
                        say(
                          "Simulated authorization expiry. Dependent reads are paused until reauthorized — nothing is silently retried in the background.",
                        );
                      }}
                      style={ghostBtn}
                    >
                      {t.simulateAuthExpiry}
                    </button>
                  )}
                </>
              }
            />
            <ConnectionCard
              title={t.folderConnection}
              icon={<FolderSvg />}
              statusLabel={
                state.folderStatus === "watching"
                  ? "Watching"
                  : state.folderStatus === "paused"
                    ? "Paused"
                    : "Authorization required"
              }
              statusTone={
                state.folderStatus === "watching"
                  ? "ok"
                  : state.folderStatus === "paused"
                    ? "neutral"
                    : "warn"
              }
              rule={t.folderRuleDesc}
              last={`Last scan ${state.folderLastScanAt} · 1 new file, 1 updated version found`}
              actions={
                <>
                  <button
                    onClick={() => {
                      if (state.folderStatus !== "watching") {
                        say("Resume the folder connection before scanning.");
                        return;
                      }
                      set({ folderLastScanAt: "9 Sep 2026, just now" });
                      say(
                        "Scan now (simulated): Screening_Report_v2.docx discovered as a new version; no other changes.",
                      );
                    }}
                    style={primaryBtn}
                  >
                    {t.scanNow}
                  </button>
                  <button
                    onClick={() => {
                      const n = state.folderStatus === "paused" ? "watching" : "paused";
                      set({ folderStatus: n });
                      say(
                        n === "paused"
                          ? "Folder monitoring paused. This does not remove materials already received."
                          : "Folder monitoring resumed.",
                      );
                    }}
                    style={secondaryBtn}
                  >
                    {state.folderStatus === "paused" ? "Resume" : "Pause"}
                  </button>
                  {state.folderStatus === "auth_required" && (
                    <button
                      onClick={() => {
                        set({ folderStatus: "watching" });
                        say(
                          "Reauthorized. The connection resumes watching from its last checkpoint.",
                        );
                      }}
                      style={warnBtn}
                    >
                      {t.reauthorize}
                    </button>
                  )}
                </>
              }
            />
          </div>
          <div
            style={{
              padding: "11px 14px",
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "var(--surface-2)",
              fontSize: 11.5,
              color: "var(--ink-3)",
              lineHeight: 1.5,
            }}
          >
            {t.connectionsSimulated}
          </div>
        </>
      )}

      {state.filesTab === "activity" && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["All", "Upload", "Email read", "Folder scan", "Download"].map((f) => (
              <Chip
                key={f}
                label={f}
                active={state.activityFilter === f}
                onClick={() => set({ activityFilter: f })}
              />
            ))}
          </div>
          <div
            role="table"
            aria-label={t.integrationActivity}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "11px 16px",
                borderBottom: "1px solid var(--line)",
                display: "grid",
                gridTemplateColumns: "1fr 1.4fr 1fr 1fr 0.9fr",
                gap: 10,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10.5,
                letterSpacing: ".05em",
                color: "var(--ink-3)",
              }}
            >
              <div>{t.colTime}</div>
              <div>{t.colOperation}</div>
              <div>{t.colSourceActivity}</div>
              <div>{t.colStatusActivity}</div>
              <div></div>
            </div>
            {FILE_ACTIVITY_DEFAULTS.filter(
              (a) => state.activityFilter === "All" || a.type === state.activityFilter,
            ).map((a) => {
              const status = state.activityRetried[a.id]
                ? "Succeeded"
                : a.status === "Failed"
                  ? "Failed"
                  : a.status;
              const expanded = !!state.activityExpanded[a.id];
              return (
                <div key={a.id}>
                  <div
                    style={{
                      padding: "11px 16px",
                      borderBottom: "1px solid var(--line)",
                      display: "grid",
                      gridTemplateColumns: "1fr 1.4fr 1fr 1fr 0.9fr",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 11,
                        color: "var(--ink-3)",
                      }}
                    >
                      {a.time}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a.op}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                        {a.detail}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{a.source}</div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        color:
                          status === "Succeeded"
                            ? "var(--ok)"
                            : status === "Failed"
                              ? "var(--bad)"
                              : status === "Needs review"
                                ? "var(--warn)"
                                : "var(--ink-2)",
                      }}
                    >
                      {status}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() =>
                          set({
                            activityExpanded: {
                              ...state.activityExpanded,
                              [a.id]: !expanded,
                            },
                          })
                        }
                        style={{
                          height: 26,
                          padding: "0 10px",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          background: "var(--surface)",
                          fontSize: 11.5,
                          cursor: "pointer",
                        }}
                      >
                        {expanded ? "Hide" : "Details"}
                      </button>
                      {a.retriable && !state.activityRetried[a.id] && (
                        <button
                          onClick={() => {
                            set({
                              activityRetried: { ...state.activityRetried, [a.id]: true },
                            });
                            say(
                              "Retried the download only — the original read history is unchanged, and a new attempt is recorded alongside it.",
                            );
                          }}
                          style={{
                            height: 26,
                            padding: "0 10px",
                            border: "1px solid var(--line-strong)",
                            borderRadius: 8,
                            background: "var(--surface)",
                            fontSize: 11.5,
                            cursor: "pointer",
                          }}
                        >
                          {t.retryButton}
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded && (
                    <div
                      style={{
                        padding: "11px 16px 13px 26%",
                        borderBottom: "1px solid var(--line)",
                        background: "var(--surface-2)",
                        fontSize: 11.5,
                        color: "var(--ink-2)",
                        lineHeight: 1.6,
                      }}
                    >
                      {a.id === "a7"
                        ? "Attempt 1 · 09:14 — Screening_Report_v2.docx: succeeded · Assessment_Result.pdf: succeeded · notes.exe: failed (unsupported type). Retry only the failed item; successful files remain available."
                        : a.id === "a2"
                          ? `Attempt 1 · 16:40 — failed: export service timeout. ${
                              state.activityRetried[a.id]
                                ? "Attempt 2 · just now — succeeded; original failure retained for audit."
                                : "No retry recorded yet."
                            }`
                          : "Source version and operation details are retained. This prototype does not contact a real external system."}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ConnectionCard({
  title,
  icon,
  statusLabel,
  statusTone,
  rule,
  last,
  actions,
}: {
  title: string;
  icon: React.ReactNode;
  statusLabel: string;
  statusTone: "ok" | "warn" | "neutral";
  rule: string;
  last: string;
  actions: React.ReactNode;
}) {
  const statusColor =
    statusTone === "ok"
      ? { bg: "var(--ok-soft)", fg: "var(--ok)" }
      : statusTone === "warn"
        ? { bg: "var(--warn-soft)", fg: "var(--warn)" }
        : { bg: "var(--surface-3)", fg: "var(--ink-2)" };
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 14,
        background: "var(--surface)",
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ color: "var(--brand)" }}>{icon}</span>
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{title}</div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 22,
            padding: "0 8px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: statusColor.bg,
            color: statusColor.fg,
          }}
        >
          {statusLabel}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-2)" }}>{rule}</div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--ink-3)" }}>{last}</div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {actions}
      </div>
    </div>
  );
}

const primaryBtn = {
  height: 30,
  padding: "0 12px",
  border: "1px solid var(--brand)",
  borderRadius: 9,
  background: "var(--brand)",
  color: "var(--brand-ink)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
} as const;

const secondaryBtn = {
  height: 30,
  padding: "0 12px",
  border: "1px solid var(--line-strong)",
  borderRadius: 9,
  background: "var(--surface)",
  fontSize: 12,
  cursor: "pointer",
} as const;

const warnBtn = {
  height: 30,
  padding: "0 12px",
  border: "1px solid var(--warn)",
  borderRadius: 9,
  background: "var(--warn-soft)",
  color: "var(--warn)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
} as const;

const ghostBtn = {
  height: 30,
  padding: "0 12px",
  border: "1px solid var(--line)",
  borderRadius: 9,
  background: "transparent",
  color: "var(--ink-3)",
  fontSize: 12,
  cursor: "pointer",
} as const;