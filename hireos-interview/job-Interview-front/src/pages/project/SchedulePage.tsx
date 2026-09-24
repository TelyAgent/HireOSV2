import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { useStore } from "../../store/StoreContext";
import { Pill } from "../../utils/status";
import { CloseSvg } from "../../components/ui/Icons";
import { api, type ApiError, type Round } from "../../features/project-intake/api";
import { errorText } from "../../features/project-intake/i18n";
import { API_BASE_URL } from "../../utils/apiBase";

const meetingLabel = (format: string, zh: boolean) => {
  if (format === "Work sample") return zh ? "作品评审（模拟）" : "Work sample review (simulated)";
  if (format === "Onsite panel") return zh ? "现场面谈（模拟）" : "In-person (simulated)";
  return "Google Meet (simulated)";
};

// A Zoom link can be joined right inside Live Interview (see meetings/zoom-host.service.ts
// — the round's meeting already exists there under its own id); anything else (a pasted
// Google Meet link, etc.) has no in-app join path, so it just opens externally as before.
const isZoomLink = (url: string) => { try { return new URL(url).hostname.endsWith("zoom.us"); } catch { return false; } };

// The datetime-local input is parsed in the browser's own local time zone to produce the
// stored instant; the separate `timezone` field is only a display label typed by the
// scheduler (matches the "simulated, clearly labeled" scheduling scope — no real calendar
// integration or time-zone math, same boundary the Project Intake plan set for this stage).
const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function SchedulePage() {
  const { state, set, say, t } = useStore();
  const zh = state.lang === "zh";
  const taskId = state.currentTaskId;

  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadRounds = () => {
    if (!taskId) { setLoading(false); return; }
    setLoading(true);
    api<Round[]>(`/tasks/${taskId}/rounds`)
      .then((rows) => { setRounds(rows); setLoadError(""); })
      .catch((e: ApiError) => setLoadError(e.code))
      .finally(() => setLoading(false));
  };
  useEffect(loadRounds, [taskId]);

  const [openRoundId, setOpenRoundId] = useState<string | null>(null);
  const [draftAt, setDraftAt] = useState("");
  const [draftTz, setDraftTz] = useState("UTC+8");
  const [draftLink, setDraftLink] = useState("");
  const [saving, setSaving] = useState(false);
  type ZoomConnection = { connected: boolean; name: string | null; pending: boolean; error: string | null };
  const [zoomConnection, setZoomConnection] = useState<ZoomConnection | null>(null);
  const [zoomAuthBusy, setZoomAuthBusy] = useState(false);

  const loadZoomStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}api/meetings/host/status`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.code || "ZOOM_STATUS_FAILED");
      setZoomConnection(body);
    } catch (error) {
      const code = error instanceof Error ? error.message : "ZOOM_STATUS_FAILED";
      setZoomConnection({ connected: false, name: null, pending: false, error: code });
    }
  };

  useEffect(() => {
    void loadZoomStatus();
  }, []);

  const authorizeZoom = async () => {
    if (zoomAuthBusy) return false;
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      say(errorText("POPUP_BLOCKED", state.lang));
      return false;
    }
    popup.opener = null;
    setZoomAuthBusy(true);
    setZoomConnection((current) => current ? { ...current, pending: true, error: null } : { connected: false, name: null, pending: true, error: null });
    try {
      const authRes = await fetch(`${API_BASE_URL}api/meetings/host/authorize`, { method: "POST", headers: { "x-hireos-zoom": "1" } });
      const authBody = await authRes.json().catch(() => ({}));
      if (!authRes.ok) throw new Error(authBody.code || "ZOOM_AUTH_FAILED");
      const url = new URL(authBody.authorizationUrl);
      if (url.origin !== "https://zoom.us") throw new Error("ZOOM_AUTH_FAILED");
      popup.location.href = url.href;

      let connected = false;
      for (let i = 0; i < 60 && !connected; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        const statusRes = await fetch(`${API_BASE_URL}api/meetings/host/status`, { cache: "no-store" });
        const status = await statusRes.json().catch(() => ({}));
        if (status.connected && !status.pending) {
          connected = true;
          setZoomConnection(status);
        } else if (status.error) {
          throw new Error(status.error);
        }
      }
      if (!connected) throw new Error("ZOOM_AUTH_EXPIRED");
      say(zh ? "Zoom 主持人账号已授权。" : "The Zoom host account is authorized.");
      return true;
    } catch (error) {
      popup.close();
      const code = error instanceof Error ? error.message : "ZOOM_AUTH_FAILED";
      setZoomConnection((current) => current ? { ...current, pending: false, error: code } : { connected: false, name: null, pending: false, error: code });
      say(errorText(code, state.lang));
      return false;
    } finally {
      setZoomAuthBusy(false);
      void loadZoomStatus();
    }
  };

  const openSchedule = (r: Round) => {
    setOpenRoundId(r.id);
    setDraftAt(r.scheduledAt ? toDatetimeLocal(r.scheduledAt) : "");
    setDraftTz(r.timezone || "UTC+8");
    setDraftLink(r.meetingLink || "");
  };
  const closeDrawer = () => setOpenRoundId(null);

  // Real Zoom integration (see meetings/zoom-host.service.ts) — connects the scheduler's
  // own Zoom account once via OAuth, then generates one independent, reusable meeting per
  // round (keyed by this round's id). Same connect-via-popup pattern as the Live Interview
  // host panel; clicking again for the same round just returns its existing link.
  const [zoomPhase, setZoomPhase] = useState<"idle" | "connecting" | "generating">("idle");
  const generateZoomLink = async () => {
    if (zoomPhase !== "idle") return;
    const round = rounds.find((r) => r.id === openRoundId);
    if (!round) return;
    try {
      const statusRes = await fetch(`${API_BASE_URL}api/meetings/host/status`);
      const status = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok) throw new Error(status.code || "ZOOM_STATUS_FAILED");
      if (!status.connected) {
        setZoomPhase("connecting");
        const authorized = await authorizeZoom();
        if (!authorized) throw new Error("ZOOM_AUTH_FAILED");
      }
      setZoomPhase("generating");
      const linkRes = await fetch(`${API_BASE_URL}api/meetings/host/link`, {
        method: "POST", headers: { "x-hireos-zoom": "1", "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: round.id, topic: `HireOS Interview — ${round.name}` }),
      });
      const linkBody = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) throw new Error(linkBody.code || "ZOOM_CREATE_FAILED");
      setDraftLink(linkBody.joinUrl);
      say(zh ? "已生成该轮次专属的真实 Zoom 会议链接。" : "Generated a real Zoom meeting link for this round.");
    } catch (e) {
      const code = e instanceof Error ? e.message : "ZOOM_CREATE_FAILED";
      say(errorText(code, state.lang));
    } finally {
      setZoomPhase("idle");
    }
  };

  const saveSchedule = async () => {
    const round = rounds.find((r) => r.id === openRoundId);
    if (!round || !draftAt) return;
    setSaving(true);
    try {
      await api(`/rounds/${round.id}/schedule`, { method: "POST", body: JSON.stringify({
        version: round.version, scheduledAt: new Date(draftAt).toISOString(), timezone: draftTz.trim() || "UTC", meetingLink: draftLink.trim(),
      }) });
      say(zh ? `${round.name} 已排期。邀请与日历占用为模拟操作，已明确标注。` : `${round.name} scheduled. Invitation and calendar hold are simulated and clearly labeled.`);
      closeDrawer();
      loadRounds();
    } catch (e) {
      const code = (e as ApiError).code;
      say(code === "VERSION_CONFLICT"
        ? (zh ? "该轮次已被其他人更新，请重新打开后再排期。" : "This round was updated elsewhere — reopen it and try again.")
        : errorText(code, state.lang));
    } finally {
      setSaving(false);
    }
  };

  const followUpRows = state.followUpRounds.map((r) => ({
    id: r.id,
    name: r.name,
    dur: r.format === "work_sample" ? "45 min" : "30 min",
    when: r.status === "completed" ? (zh ? "刚刚完成" : "Completed just now") : r.status === "Scheduled" ? `${r.due}, 4:00 PM UTC+8` : t.notScheduledLabel,
    interviewer: r.ownerName,
    initials: r.ownerInitials,
    meeting: r.format === "work_sample" ? (zh ? "作品评审（模拟）" : "Work sample review (simulated)") : "Google Meet (simulated)",
    statusLabel: r.status === "completed" ? t.scheduleStatusCompleted : r.status === "Scheduled" ? t.scheduleStatusScheduled : t.scheduleStatusPlanned,
    done: r.status === "completed",
    action: () => {
      if (r.status === "completed") { set({ screen: "review" }); return; }
      if (r.status === "Scheduled") {
        set({
          followUpRounds: state.followUpRounds.map((x) => (x.id === r.id ? { ...x, status: "completed" as const } : x)),
          r2Scores: { ...state.r2Scores, sca: 3 },
          decision: null, decHr: false, decHm: false, decRecorded: false, screen: "debrief",
        });
        say(zh ? "补充轮次已完成。安全与合规意识现已具备 3 级人工证据；汇总评估已刷新，可重新做出决定。" : "Follow-up completed. Security & Compliance Awareness now has level-3 human evidence; the debrief has been refreshed for a new decision.");
        return;
      }
      set({ followUpRounds: state.followUpRounds.map((x) => (x.id === r.id ? { ...x, status: "Scheduled" as const } : x)) });
      say(zh ? `补充轮次已排期至 ${state.evidenceDue}。` : `Follow-up scheduled for ${state.evidenceDue}.`);
    },
    actionLabel: r.status === "completed" ? t.scheduleActionViewRecord : r.status === "Scheduled" ? (zh ? "完成补充轮次" : "Complete follow-up") : t.scheduleActionSchedule,
  }));

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-[15px] py-3">
        <span>🌐</span>
        <div className="text-[12.5px]">{t.timezoneNote}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${zoomConnection?.connected ? "bg-[var(--ok)]" : "bg-[var(--ink-3)]"}`} />
          <div>
            <div className="text-[12.5px] font-semibold">{zh ? "Zoom 主持人账号" : "Zoom host account"}</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">
              {zoomConnection?.connected
                ? `${zh ? "已连接：" : "Connected: "}${zoomConnection.name || (zh ? "已授权账号" : "Authorized account")}`
                : zoomConnection?.pending
                  ? (zh ? "等待授权完成…" : "Waiting for authorization…")
                  : (zh ? "尚未授权" : "Not authorized")}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={zoomAuthBusy}
          onClick={() => void authorizeZoom()}
          className="h-8 cursor-pointer rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 text-[12px] font-semibold text-[var(--ink-2)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {zoomAuthBusy ? (zh ? "授权中…" : "Authorizing…") : zoomConnection?.connected ? (zh ? "重新授权" : "Reauthorize") : (zh ? "授权 Zoom" : "Authorize Zoom")}
        </button>
        {zoomConnection?.error && (
          <div role="alert" className="basis-full text-[11.5px] text-[var(--bad)]">
            {errorText(zoomConnection.error, state.lang)}
          </div>
        )}
      </div>

      {loading && <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[17px] py-[15px] text-xs text-[var(--ink-3)]">{zh ? "加载中…" : "Loading…"}</div>}
      {!loading && loadError && (
        <div role="alert" className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[17px] py-[15px] text-xs text-[var(--ink-3)]">
          {errorText(loadError, state.lang)}{" "}
          <button onClick={loadRounds} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--brand)] underline">{zh ? "重试" : "Retry"}</button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--surface)]">
          <div className="grid grid-cols-[1.6fr_1.2fr_1fr_1.2fr_1fr] gap-2.5 border-b border-[var(--line)] px-4 py-[11px] font-mono text-[10.5px] tracking-[0.05em] text-[var(--ink-3)]">
            <div>{t.colRound}</div>
            <div>{t.colDateTime}</div>
            <div>{t.colInterviewer}</div>
            <div>{t.colMeeting}</div>
            <div>{t.colStatus}</div>
          </div>

          {rounds.map((r) => {
            const isScheduled = !!r.scheduledAt && r.status !== "completed";
            const statusLabel = r.status === "completed" ? t.scheduleStatusCompleted : isScheduled ? t.scheduleStatusScheduled : t.scheduleStatusPlanned;
            const when = r.scheduledAt
              ? `${new Date(r.scheduledAt).toLocaleString(zh ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ${r.timezone || ""}`
              : t.notScheduledLabel;
            const ownerName = r.interviewer ? r.interviewer.name : (zh ? "待指定" : "Unassigned");
            const initials = r.interviewer ? r.interviewer.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase() : "—";
            const actionLabel = r.status === "completed" ? t.scheduleActionViewRecord : r.scheduledAt ? t.scheduleActionReschedule : t.scheduleActionSchedule;
            return (
              <div key={r.id} className="grid grid-cols-[1.6fr_1.2fr_1fr_1.2fr_1fr] items-center gap-2.5 border-b border-[var(--line)] px-4 py-[13px] last:border-b-0">
                <div>
                  <div className="text-[13px] font-semibold">{r.name}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">{r.duration} {zh ? "分钟" : "min"}</div>
                </div>
                <div className="text-[12.5px]">{when}</div>
                <div className="flex items-center gap-[7px]">
                  <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-[var(--surface-3)] text-[10px] font-bold">{initials}</div>
                  <div className="text-[12.5px]">{ownerName}</div>
                </div>
                <div>
                  {r.status === "completed" ? (
                    <div className="inline-flex h-[22px] items-center rounded-md bg-[var(--surface-3)] px-2 text-[11.5px] text-[var(--ink-3)]" title={zh ? "面试已完成，会议已结束" : "Interview completed; the meeting has ended"}>
                      📹 {zh ? "会议已结束" : "Meeting ended"}
                    </div>
                  ) : r.meetingLink && isZoomLink(r.meetingLink) ? (
                    <button
                      onClick={() => set({ liveJoinRound: { roundId: r.id, topic: `HireOS Interview — ${r.name}` }, screen: "live" })}
                      className="inline-flex h-[22px] cursor-pointer items-center rounded-md border-0 bg-[var(--brand-soft)] px-2 text-[11.5px] text-[var(--brand)] underline"
                    >
                      📹 {t.joinMeetingLabel}
                    </button>
                  ) : r.meetingLink ? (
                    <a
                      href={r.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-[22px] items-center rounded-md bg-[var(--brand-soft)] px-2 text-[11.5px] text-[var(--brand)] underline"
                    >
                      📹 {t.joinMeetingLabel}
                    </a>
                  ) : (
                    <div className="inline-flex h-[22px] items-center rounded-md bg-[var(--surface-3)] px-2 text-[11.5px] text-[var(--ink-2)]">
                      📹 {meetingLabel(r.format, zh)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Pill label={statusLabel} tone={r.status === "completed" ? "ok" : isScheduled ? "warn" : "unknown"} />
                  <button
                    onClick={() => {
                      if (r.status === "completed") { set({ roundView: r.sequence === 2 ? "r2" : "r1", screen: "live" }); return; }
                      if (!state.planApproved) { say(zh ? "请先确定面试计划，再进行排期。" : "Approve the interview plan before scheduling."); return; }
                      openSchedule(r);
                    }}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[var(--brand)] underline"
                  >
                    {actionLabel}
                  </button>
                </div>
              </div>
            );
          })}

          {followUpRows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1.6fr_1.2fr_1fr_1.2fr_1fr] items-center gap-2.5 border-b border-[var(--line)] px-4 py-[13px] last:border-b-0">
              <div>
                <div className="text-[13px] font-semibold">{r.name}</div>
                <div className="text-[11.5px] text-[var(--ink-3)]">{r.dur}</div>
              </div>
              <div className="text-[12.5px]">{r.when}</div>
              <div className="flex items-center gap-[7px]">
                <div className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-[var(--surface-3)] text-[10px] font-bold">{r.initials}</div>
                <div className="text-[12.5px]">{r.interviewer}</div>
              </div>
              <div>
                <div className="inline-flex h-[22px] items-center rounded-md bg-[var(--surface-3)] px-2 text-[11.5px] text-[var(--ink-2)]">📹 {r.meeting}</div>
              </div>
              <div className="flex items-center gap-2">
                <Pill label={r.statusLabel} tone={r.done ? "ok" : "warn"} />
                <button onClick={r.action} className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[var(--brand)] underline">
                  {r.actionLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => say(zh ? "补面轮次将沿用评分标准 v1，且只覆盖与其相关的能力项。" : "A make-up round would inherit rubric v1 and only the competencies scoped to it.")}
        className="h-[34px] cursor-pointer self-start rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface)] px-[13px] text-[12.5px]"
      >
        {t.addMakeupRound}
      </button>

      {state.inviteFailed && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--bad)] bg-[var(--bad-soft)] px-[15px] py-3">
          <div className="flex-1 text-[12.5px] leading-[1.45]">
            {zh ? "投递失败：elena.torres@example.com 邮箱已满，未创建日历占用。" : "Delivery failed: elena.torres@example.com bounced (mailbox full). No calendar hold was created."}
          </div>
          <button
            onClick={() => { set({ inviteFailed: false }); say(zh ? "已重试 — 模拟邀请已送达。" : "Retried — simulated invitation delivered."); }}
            className="h-7 cursor-pointer rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] text-xs"
          >
            {t.retry}
          </button>
          <button
            onClick={() => { set({ inviteFailed: true }); say(zh ? "模拟投递失败：邮箱已满，未创建日历占用。" : "Simulated delivery failure: mailbox full. No calendar hold was created."); }}
            className="h-7 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent px-[11px] text-xs text-[var(--ink-3)]"
          >
            {t.simulateAgain}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--ai)] bg-[var(--ai-soft)] px-[15px] py-3">
        <span>+</span>
        <div className="text-[12.5px] leading-[1.45]">
          <b>{t.simulatedForPrototype}</b> {zh ? "以 Google Meet 为主，Zoom 作为备选，本原型不会发送真实邀请。" : "Google Meet primary, Zoom supported as an alternative — no real invitations are sent."}{" "}
          <button
            onClick={() => { set({ inviteFailed: true }); say(zh ? "模拟投递失败：邮箱已满，未创建日历占用。" : "Simulated delivery failure: mailbox full. No calendar hold was created."); }}
            className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-[var(--ink)] underline"
          >
            {t.simulateBounce}
          </button>
          .
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-[13px]">
        <div className="flex-1" />
        <button onClick={() => set({ screen: "plan" })} className="h-[34px] cursor-pointer rounded-[11px] border border-transparent bg-transparent px-3 text-[12.5px] text-[var(--ink-2)]">
          {t.backToPlan}
        </button>
        <button onClick={() => set({ screen: "brief" })} className="h-[34px] cursor-pointer rounded-[11px] border border-[var(--brand)] bg-[var(--brand)] px-[15px] text-[12.5px] font-semibold text-[var(--brand-ink)]">
          {t.continueToBrief}
        </button>
      </div>

      <Drawer
        open={!!openRoundId}
        onClose={closeDrawer}
        placement="right"
        width={440}
        closable={false}
        styles={{ body: { padding: 0 }, wrapper: { width: "min(440px, 96vw)" }, footer: { padding: 0 } }}
        footer={
          <div className="flex justify-end gap-2.5 px-5 py-3.5">
            <button onClick={closeDrawer} className="h-9 cursor-pointer rounded-[9px] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] text-[var(--ink-2)]">
              {t.cancel}
            </button>
            <button disabled={saving || !draftAt} onClick={saveSchedule} className="h-9 cursor-pointer rounded-[9px] border border-[var(--brand)] bg-[var(--brand)] px-[15px] text-[12.5px] font-semibold text-[var(--brand-ink)] disabled:cursor-not-allowed disabled:opacity-60">
              {t.saveSchedule}
            </button>
          </div>
        }
      >
        <div className="sticky top-0 z-[2] flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5 pb-[15px] pt-[17px]">
          <div className="flex-1 text-lg font-bold">{t.scheduleDrawerTitle}</div>
          <button aria-label={t.close} onClick={closeDrawer} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]">
            <CloseSvg />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-6 pt-5">
          <label className="block">
            <div className="mb-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">{t.scheduleDateTimeLabel}</div>
            <input
              type="datetime-local"
              value={draftAt}
              onChange={(e) => setDraftAt(e.target.value)}
              className="h-10 w-full rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--ink)]"
            />
          </label>
          <label className="block">
            <div className="mb-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">{t.scheduleTimezoneLabel}</div>
            <input
              value={draftTz}
              onChange={(e) => setDraftTz(e.target.value)}
              className="h-10 w-full rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--ink)]"
            />
            <div className="mt-[5px] text-[11px] text-[var(--ink-3)]">{t.scheduleTimezoneHint}</div>
          </label>
          <label className="block">
            <div className="mb-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">{t.scheduleMeetingLinkLabel}</div>
            <div className="flex gap-2">
              <input
                value={draftLink}
                onChange={(e) => setDraftLink(e.target.value)}
                placeholder={t.scheduleMeetingLinkPlaceholder}
                className="h-10 flex-1 rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--ink)]"
              />
              <button
                type="button"
                disabled={zoomPhase !== "idle"}
                onClick={generateZoomLink}
                className="h-10 flex-none cursor-pointer whitespace-nowrap rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {zoomPhase === "connecting" ? t.zoomConnecting : zoomPhase === "generating" ? t.zoomGenerating : t.zoomGenerateCta}
              </button>
            </div>
            <div className="mt-[5px] text-[11px] text-[var(--ink-3)]">{t.scheduleMeetingLinkHint}</div>
          </label>
        </div>
      </Drawer>
    </>
  );
}
