import { useStore } from "../store/StoreContext";
import { useEffect, useState } from 'react';
import { api, type ApiError, type JobSummary, type TaskSummary } from '../features/project-intake/api';
import { errorText, intakeText } from '../features/project-intake/i18n';
import { Pill } from "../utils/status";
import { SurfaceCard, Banner, Chip } from "../components/ui/Primitives";
import { TASK_STATUS_META, taskFilterBucket, type Candidate, type Job, type InterviewTask, type TaskStatus } from "../data/domain";
import {
  BriefcaseSvg,
  CalendarSvg,
  ChartSvg,
  CheckCircleSvg,
  ChevronSvg,
  GridSvg,
  HomeSvg,
  NoteSvg,
  PauseSvg,
  TrendSvg,
} from "../components/ui/Icons";

function initialsFromTitle(title: string) {
  return title.slice(0, 2).toUpperCase();
}
function initialsFromName(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function HomePage() {
  const { state, t, set, openTask, role, say } = useStore();
  const it = intakeText(state.lang);
  const [savedJobs, setSavedJobs] = useState<JobSummary[]>([]);
  const [savedTasks, setSavedTasks] = useState<TaskSummary[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api<JobSummary[]>('/jobs'), api<TaskSummary[]>('/tasks')])
      .then(([jobRows, taskRows]) => { if (active) { setSavedJobs(jobRows); setSavedTasks(taskRows); setLoadError(''); } })
      .catch((e: ApiError) => { if (active) setLoadError(e.code); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  // Jobs/Résumés/Tasks handed off from the Resume Screening subsystem, fetched from the
  // real API (see src/data/domain.ts for the shape). A task is a unique (Job, Candidate)
  // pair; a JD with no matched résumé yet is a Job with zero tasks, not a task itself.
  const jobs: Job[] = savedJobs.map((j) => ({
    id: j.id, title: j.title, department: j.department || "", location: j.location || "", level: j.level || "",
    recruitingStatus: j.recruitingStatus, createdAt: j.createdAt,
  }));
  const candidatesById = new Map<string, Candidate>(
    savedTasks.map((t) => [t.candidate.id, { id: t.candidate.id, name: t.candidate.name, email: t.candidate.email || "" }]),
  );
  const tasks: InterviewTask[] = savedTasks.map((t) => ({
    id: t.id, jobId: t.jobId, candidateId: t.candidate.id,
    status: t.status as TaskStatus, roundsCompleted: t.rounds.filter((r) => r.status === "completed").length, roundsPlanned: t.rounds.length,
    screening: { matchScore: t.matchScore ?? 0, recommendation: t.matchRecommendation ?? "match", handedOffAt: t.createdAt } as InterviewTask["screening"],
    createdAt: t.createdAt,
  }));
  const jobsById = new Map(jobs.map((j) => [j.id, j]));

  const taskRows = tasks.map((task) => {
    const job = jobsById.get(task.jobId);
    const candidate = candidatesById.get(task.candidateId);
    const meta = TASK_STATUS_META[task.status];
    const progress = task.progressNote
      ? (state.lang === "zh" ? task.progressNote.zh : task.progressNote.en)
      : task.roundsPlanned > 0
        ? (state.lang === "zh" ? `${task.roundsCompleted} / ${task.roundsPlanned} 轮已完成` : `${task.roundsCompleted} / ${task.roundsPlanned} rounds completed`)
        : it.notPlanned;
    return {
      id: task.id,
      jobId: task.jobId,
      role: job?.title || it.notLinked,
      candidate: candidate?.name || it.notLinked,
      candidateLinked: !!candidate,
      status: task.status,
      statusLabel: state.lang === "zh" ? meta.zh : meta.en,
      tone: meta.tone,
      roleInitials: job ? initialsFromTitle(job.title) : "--",
      candidateInitials: candidate ? initialsFromName(candidate.name) : (job ? initialsFromTitle(job.title) : "--"),
      progress,
      matchScore: task.screening.matchScore,
      currentRound: task.currentRound
        ? { label: state.lang === "zh" ? task.currentRound.label.zh : task.currentRound.label.en, interviewer: task.currentRound.interviewer }
        : null,
      created: new Date(task.createdAt).toLocaleDateString(state.lang === "zh" ? "zh-CN" : "en-US"),
      createdAt: task.createdAt,
      open: () => openTask(task.id, "overview"),
    };
  });

  const jobIdsWithTasks = new Set(taskRows.map((r) => r.jobId));
  const draftOnlyJobCount = jobs.filter((j) => !jobIdsWithTasks.has(j.id)).length;

  const counts = {
    "All projects": taskRows.length + draftOnlyJobCount,
    "Needs my confirmation": taskRows.filter((r) => taskFilterBucket(r.status) === "Needs my confirmation").length,
    Draft: taskRows.filter((r) => taskFilterBucket(r.status) === "Draft").length + draftOnlyJobCount,
    Published: taskRows.filter((r) => taskFilterBucket(r.status) === "Published").length,
  };

  const searchQuery = state.searchQuery.trim().toLowerCase();
  const taskMatches = (p: (typeof taskRows)[number]) => {
    const matchesSearch = !searchQuery || [p.role, p.candidate, p.statusLabel].join(" ").toLowerCase().includes(searchQuery);
    const bucket = taskFilterBucket(p.status);
    const matchesFilter = state.homeFilter === "All projects" || state.homeFilter === bucket;
    return matchesSearch && matchesFilter;
  };
  const filteredProjects = taskRows.filter(taskMatches);

  const roleGroups = jobs
    .map((job) => {
      const allCandidates = taskRows.filter((r) => r.jobId === job.id);
      return {
        jobId: job.id,
        role: job.title,
        initials: initialsFromTitle(job.title),
        created: new Date(job.createdAt).toLocaleDateString(state.lang === "zh" ? "zh-CN" : "en-US"),
        allCandidates,
        candidates: allCandidates.filter(taskMatches),
      };
    })
    .filter((g) => {
      if (g.candidates.length > 0) return true;
      if (g.allCandidates.length > 0) return false; // has tasks, none matched the current filter/search
      if (searchQuery && !g.role.toLowerCase().includes(searchQuery)) return false;
      return state.homeFilter === "All projects" || state.homeFilter === "Draft";
    });

  const myWorkCards = [
    {
      label: t.cardMyRemaining,
      value: 0,
      sub: t.cardMyRemainingSub,
      icon: <HomeSvg />,
    },
    {
      label: t.cardAwaitingSchedule,
      value: 0,
      sub: t.cardAwaitingScheduleSub,
      icon: <CalendarSvg />,
    },
    {
      label: t.cardScorecards,
      value: 0,
      sub: t.cardScorecardsSub,
      icon: <NoteSvg />,
    },
    {
      label: t.cardDecisions,
      value: 0,
      sub: role.key === "iv" ? t.cardDecisionsSubNA : t.cardDecisionsSub,
      icon: <CheckCircleSvg />,
    },
  ];

  // HOME-G02/G03/G07 (PRD Section 8.2.2): distinct role_id-based counts, not project counts.
  const openRolesCount = jobs.filter((j) => j.recruitingStatus === "open").length;
  const rolesInInterviewIds = new Set(
    taskRows
      .filter((r) => ["interview_in_progress", "evidence_requested", "awaiting_confirmation", "on_hold"].includes(r.status))
      .map((r) => r.jobId),
  );
  const unknownRolesCount = jobs.filter((j) => j.recruitingStatus === "unknown").length;

  const overviewCards = [
    { label: t.cardTotalProjects, value: counts["All projects"], sub: t.cardTotalProjectsSub, icon: <GridSvg /> },
    { label: t.cardRolesRecruiting, value: openRolesCount, sub: t.cardRolesRecruitingSub, icon: <BriefcaseSvg /> },
    { label: t.cardRolesInInterview, value: rolesInInterviewIds.size, sub: t.cardRolesInInterviewSub, icon: <TrendSvg /> },
  ];

  const moreCards = [
    { label: t.cardTodayInterviews, value: 0, sub: t.cardTodayInterviewsSub, icon: <CalendarSvg /> },
    { label: t.cardNext7, value: 0, sub: t.cardNext7Sub, icon: <CalendarSvg /> },
    { label: t.cardActiveProjects, value: 0, sub: t.cardActiveProjectsSub, icon: <BoltIcon /> },
    { label: t.cardAwaitingJoint, value: 0, sub: t.cardAwaitingJointSub, icon: <CheckCircleSvg /> },
    { label: t.cardAwaitingScheduling, value: 0, sub: t.cardAwaitingSchedulingSub, icon: <CalendarSvg /> },
    { label: t.cardUnknownRoles, value: unknownRolesCount, sub: t.cardUnknownRolesSub, icon: <HelpIcon /> },
    { label: t.cardInterviewsCompleted, value: 0, sub: t.cardLast30, icon: <ChartSvg /> },
    { label: t.cardPackagesCompleted, value: 0, sub: t.cardLast30, icon: <BoxIcon /> },
    { label: t.cardProjectsOnHold, value: 0, sub: t.cardOnHoldStatus, icon: <PauseSvg /> },
  ];

  const filters = ["All projects", "Needs my confirmation", "Draft", "Published"] as const;
  const activity = savedTasks.map((t) => ({
    text: `${t.job.title} · ${t.candidate.name}`,
    meta: new Date(t.createdAt).toLocaleString(state.lang === 'zh' ? 'zh-CN' : 'en-US'),
  }));

  const statsGrid = {
    marginTop: 11,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(200px,240px))",
    justifyContent: "start",
    gap: 12,
  };
  const statsCard = {
    minHeight: 112,
    padding: "14px 15px",
    border: "1px solid var(--line)",
    borderRadius: 14,
    background: "var(--surface)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  };

  return (
    <div
      style={{
        width: "100%",
        padding: "28px 32px 60px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div role="heading" aria-level={2} style={{ fontSize: 24, fontWeight: 700 }}>
            {t.homeTitle}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--ink-2)" }}>
            {t.homeSubtitle}
          </div>
        </div>
        <button
          onClick={() => set({ showCreateModal: true })}
          style={{
            height: 38,
            padding: "0 15px",
            border: "1px solid var(--brand)",
            borderRadius: 10,
            background: "var(--brand)",
            color: "var(--brand-ink)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t.newProject}
        </button>
      </div>

      <div>
        <div
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10.5,
            letterSpacing: ".05em",
            color: "var(--ink-3)",
          }}
        >
          {t.myWork} · {role.name}
        </div>
        <div style={statsGrid}>
          {myWorkCards.map((c, i) => (
            <div key={i} style={statsCard}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
                  {c.value}
                </div>
                <div style={{ fontWeight: 500 }}>{c.label}</div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    color: "var(--ink-3)",
                  }}
                >
                  {c.sub}
                </div>
              </div>
              <div
                style={{
                  flex: "none",
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--brand-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--brand)",
                }}
              >
                {c.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={() => set({ overviewStatsOpen: !state.overviewStatsOpen })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: 0,
            border: 0,
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
          }}
        >
          <div
            style={{
              flex: 1,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5,
              letterSpacing: ".05em",
              color: "var(--ink-3)",
            }}
          >
            {t.workspaceOverview}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {state.overviewStatsOpen ? (state.lang === "zh" ? "收起 ⌃" : "Show less ⌃") : (state.lang === "zh" ? "展开 ⌄" : "Show more ⌄")}
          </div>
        </button>
        {state.overviewStatsOpen && (
          <div style={statsGrid}>
            {overviewCards.map((c, i) => (
              <div key={i} style={statsCard}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
                    {c.value}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      color: "var(--ink-2)",
                      lineHeight: 1.35,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {c.label}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--ink-3)" }}>
                    {c.sub}
                  </div>
                </div>
                <div
                  style={{
                    flex: "none",
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--surface-3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-2)",
                  }}
                >
                  {c.icon}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => set({ moreOpen: !state.moreOpen })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: 0,
            border: 0,
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
          }}
        >
          <div
            style={{
              flex: 1,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5,
              letterSpacing: ".05em",
              color: "var(--ink-3)",
            }}
          >
            {t.moreStats}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
            {state.moreOpen ? (state.lang === "zh" ? "收起 ⌃" : "Show less ⌃") : (state.lang === "zh" ? "展开 ⌄" : "Show more ⌄")}
          </div>
        </button>
        {state.moreOpen && (
          <div style={statsGrid}>
            {moreCards.map((c, i) => (
              <div key={i} style={statsCard}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
                    {c.value}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 12,
                      color: "var(--ink-2)",
                      lineHeight: 1.35,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {c.label}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--ink-3)" }}>
                    {c.sub}
                  </div>
                </div>
                <div
                  style={{
                    flex: "none",
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--surface-3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-2)",
                  }}
                >
                  {c.icon}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "start" }}>
        <div style={{ flex: "2 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {filters.map((f) => {
                const active = state.homeFilter === f;
                return (
                  <Chip
                    key={f}
                    label={`${state.lang === 'zh' ? ({ 'All projects': '全部项目', 'Needs my confirmation': '待我确认', Draft: '草稿', Published: '已发布' })[f] : f} (${counts[f]})`}
                    active={active}
                    onClick={() => set({ homeFilter: f })}
                  />
                );
              })}
            </div>
            <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface-2)" }}>
              {([
                { mode: "tasks" as const, label: t.taskListMode, minWidth: 94 },
                { mode: "cluster" as const, label: t.clusterByRoleMode, minWidth: 118 },
              ]).map((tb) => {
                const active = state.homeViewMode === tb.mode || (tb.mode === "tasks" && state.homeViewMode !== "cluster");
                return (
                  <button
                    key={tb.mode}
                    onClick={() => set({ homeViewMode: tb.mode })}
                    style={{
                      height: 30,
                      minWidth: tb.minWidth,
                      padding: "0 12px",
                      border: 0,
                      background: active ? "var(--brand-soft)" : "transparent",
                      color: active ? "var(--brand)" : "var(--ink-3)",
                      fontSize: 11.5,
                      fontWeight: active ? 700 : 650,
                      cursor: "pointer",
                    }}
                  >
                    {tb.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            role="table"
            aria-label={t.interviewProjects}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            {loading && <div role="status" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--ink-3)" }}>{it.loading}</div>}
            {!loading && loadError && (
              <div role="alert" style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontSize: 12, color: "var(--ink-3)" }}>
                {state.lang === "zh" ? "无法加载面试项目数据：" : "Could not load interview projects: "}
                {errorText(loadError, state.lang)}{" "}
                <button onClick={() => setReload((n) => n + 1)} style={{ color: "var(--brand)", background: "none", border: 0, cursor: "pointer", padding: 0 }}>{it.retry}</button>
              </div>
            )}
            {!jobs.length && <div style={{ padding: 18 }}>{it.empty}</div>}

            {jobs.length > 0 && state.homeViewMode !== "cluster" && (
              <>
                <div
                  style={{
                    padding: "4px 16px 8px",
                    borderBottom: "1px solid var(--line)",
                    display: "grid",
                    gridTemplateColumns: "1.75fr 1.15fr 1.15fr .82fr .74fr",
                    gap: 18,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    letterSpacing: ".08em",
                    color: "var(--ink-3)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  <div>{t.colCandidateAndJd}</div>
                  <div>{t.colStatus}</div>
                  <div>{t.colProgress}</div>
                  <div>{t.colCreated}</div>
                  <div>{t.viewResume}</div>
                </div>
                {filteredProjects.length === 0 && <div style={{ padding: "14px 18px", color: "var(--ink-3)", fontSize: 12 }}>{it.noMatches}</div>}
                {filteredProjects.map((p) => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => p.open()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p.open(); } }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.75fr 1.15fr 1.15fr .82fr .74fr",
                      gap: 18,
                      width: "100%",
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--line)",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                      <div
                        style={{
                          flex: "none",
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          background: "rgba(20,184,166,.18)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: "var(--brand)",
                        }}
                      >
                        {p.candidateInitials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.candidate}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.role}{p.candidateLinked ? ` · ${state.lang === "zh" ? "匹配度" : "Match"} ${p.matchScore}%` : ""}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Pill label={p.statusLabel} tone={p.tone} />
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{p.progress}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{p.created}</div>
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          say(
                            p.candidateLinked
                              ? (state.lang === "zh" ? "简历预览功能即将上线。" : "Résumé preview is coming soon.")
                              : (state.lang === "zh" ? "请先关联候选人简历。" : "Link a candidate résumé first."),
                          );
                        }}
                        disabled={!p.candidateLinked}
                        style={{
                          height: 30,
                          width: "100%",
                          padding: "0 8px",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          background: "var(--surface)",
                          color: p.candidateLinked ? "var(--brand)" : "var(--ink-3)",
                          fontSize: 11.5,
                          cursor: p.candidateLinked ? "pointer" : "not-allowed",
                        }}
                      >
                        {t.viewResume}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {jobs.length > 0 && state.homeViewMode === "cluster" && (
              <>
                <div
                  style={{
                    padding: "11px 18px",
                    borderBottom: "1px solid var(--line)",
                    display: "grid",
                    gridTemplateColumns: "2fr 1.4fr 0.9fr",
                    gap: 10,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10.5,
                    letterSpacing: ".05em",
                    color: "var(--ink-3)",
                  }}
                >
                  <div>{t.colRole}</div>
                  <div>{t.colCandidate}</div>
                  <div>{t.colCreated}</div>
                </div>
                {roleGroups.length === 0 && <div style={{ padding: "14px 18px", color: "var(--ink-3)", fontSize: 12 }}>{it.noMatches}</div>}
                {roleGroups.map((g) => {
                  const expanded = !!expandedRoles[g.jobId];
                  const linked = g.candidates;
                  return (
                    <div key={g.jobId} style={{ borderBottom: "1px solid var(--line)" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1.4fr 0.9fr",
                          gap: 10,
                          width: "100%",
                          padding: "13px 18px",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                          <button
                            onClick={() => setExpandedRoles((prev) => ({ ...prev, [g.jobId]: !prev[g.jobId] }))}
                            aria-label={expanded ? (state.lang === "zh" ? "收起" : "Collapse") : (state.lang === "zh" ? "展开" : "Expand")}
                            style={{ width: 24, height: 24, flex: "0 0 24px", border: 0, background: "transparent", color: "var(--ink-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${expanded ? 90 : 0}deg)`, transition: "transform .16s ease" }}>
                              <path d="m9 18 6-6-6-6"></path>
                            </svg>
                          </button>
                          <div style={{ flex: "none", width: 34, height: 34, borderRadius: 9, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)" }}>
                            {g.initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{g.role}</div>
                            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>JD · {g.created}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                          {linked.length}{state.lang === "zh" ? " 位候选人" : linked.length === 1 ? " candidate" : " candidates"}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => say(state.lang === "zh" ? "该功能即将上线：为此岗位关联更多候选人。" : "Coming soon: link more candidates to this role.")}
                            style={{ height: 30, padding: "0 10px", border: "1px solid var(--brand)", borderRadius: 8, background: "var(--brand-soft)", color: "var(--brand)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                          >
                            {t.linkCandidate}
                          </button>
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ padding: "0 18px 13px 62px", background: "var(--surface-2)" }}>
                          {linked.length === 0 && <div style={{ padding: "12px 0", fontSize: 12, color: "var(--ink-3)" }}>{t.noCandidatesForJd}</div>}
                          {linked.length > 0 && (
                            <>
                              <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr .7fr 1fr .9fr", gap: 10, padding: "10px 0 4px", color: "var(--ink-3)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: ".04em" }}>
                                <div>{t.colCandidate}</div>
                                <div>{t.colStatus}</div>
                                <div>{t.colProgress}</div>
                                <div>{state.lang === "zh" ? "面试轮次 / 面试官" : "ROUND / INTERVIEWER"}</div>
                                <div>{t.viewResume}</div>
                              </div>
                              {linked.map((c) => (
                                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr .7fr 1fr .9fr", gap: 10, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                                  <div>
                                    <button onClick={() => c.open()} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", color: "var(--brand)", fontSize: 12.5, fontWeight: 650 }}>
                                      {c.candidate}
                                    </button>
                                    <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{state.lang === "zh" ? "匹配度" : "Match"} {c.matchScore}%</div>
                                  </div>
                                  <div><Pill label={c.statusLabel} tone={c.tone} /></div>
                                  <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{c.progress}</div>
                                  <div style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                                    {c.currentRound ? c.currentRound.label : (state.lang === "zh" ? "未安排" : "Not scheduled")}
                                    {c.currentRound && <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{c.currentRound.interviewer}</div>}
                                  </div>
                                  <button
                                    onClick={() => say(state.lang === "zh" ? "简历预览功能即将上线。" : "Résumé preview is coming soon.")}
                                    style={{ height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 7, background: "var(--surface)", color: "var(--brand)", fontSize: 10.5, cursor: "pointer" }}
                                  >
                                    {t.viewResume}
                                  </button>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <div
          style={{
            flex: "none",
            width: 320,
            border: "1px solid var(--line)",
            borderRadius: 14,
            background: "var(--surface)",
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10.5,
              letterSpacing: ".05em",
              color: "var(--ink-3)",
            }}
          >
            {t.recentActivity}
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 13 }}>
            {activity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    flex: "none",
                    marginTop: 5,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    background: "var(--line-strong)",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{a.text}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{a.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function homeProjects(state: any, roleKey: string, set: (p: any) => void, say: (m: string) => void) {
  const projects: { id: string; initials: string; role: string; sub: string; status: string; tone: string; candidate: string; progress: string; created: string; needs?: boolean; wired: boolean; open: () => void }[] = [
    {
      id: "p1",
      initials: "SB",
      role: "Senior Backend Engineer",
      sub: "Elena Torres · Platform Engineering",
      status: state.decRecorded ? "Package published" : "Awaiting confirmation",
      tone: state.decRecorded ? "ok" : "warn",
      candidate: "Elena Torres",
      progress: "2 / 2 rounds completed",
      created: "Aug 18, 2026",
      needs: !state.decRecorded && ((roleKey === "hr" && !state.decHr) || (roleKey === "hm" && !state.decHm)),
      wired: true,
      open: () => {
        // Reset to project p1 state
        set({
          screen: "overview",
          jdOnlyDraft: false,
          rubricExtracted: true,
          rubricConfirmed: true,
          rubricVersion: 1,
          planApproved: true,
          candidateLinked: true,
          r1Done: true,
          r2Done: true,
          r1Scheduled: true,
          r2Scheduled: true,
          decision: "Recommend for offer",
          decHr: state.decHr,
          decHm: state.decHm,
          decRecorded: state.decRecorded,
          followUpRounds: [],
        });
      },
    },
  ];

  if (state.draftCreated) {
    const newRoleTitle = (state.jdText.split("\n").map((s: string) => s.trim()).find((s: string) => s.length > 0) || "New role").slice(0, 60);
    const newRoleInitials = newRoleTitle.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() || "NP";
    const statusBadge = state.decRecorded
      ? "Package published"
      : state.followUpRounds.length > 0
        ? "Evidence requested"
        : state.decision
          ? "Awaiting confirmation"
          : state.jdOnlyDraft
            ? !state.rubricExtracted
              ? "Draft"
              : !state.rubricConfirmed
                ? "Requirements ready"
                : !state.planApproved
                  ? "Planning"
                  : !state.r1Scheduled
                    ? "Ready to schedule"
                    : !state.r2Done
                      ? "Interview in progress"
                      : "Review pending"
            : "Awaiting confirmation";
    projects.push({
      id: "pNew",
      initials: newRoleInitials,
      role: newRoleTitle,
      sub: (state.candidateLinked ? "Elena Torres" : "Candidate not linked") + " · New project",
      status: statusBadge,
      tone: statusBadge === "Draft" || statusBadge === "Requirements ready" || statusBadge === "Planning" ? "unknown" : "warn",
      candidate: state.candidateLinked ? "Elena Torres" : "Candidate not linked",
      progress: state.r2Done
        ? "2 / 2 rounds completed"
        : state.r1Done
          ? "1 / 2 rounds completed"
          : state.r1Scheduled
            ? "Rounds scheduled"
            : "Not planned yet",
      created: "Just now",
      needs: state.jdOnlyDraft && !!state.decision && state.followUpRounds.length === 0 && ((roleKey === "hr" && !state.decHr) || (roleKey === "hm" && !state.decHm)),
      wired: true,
      open: () => {
        set({ screen: "overview", jdOnlyDraft: true });
      },
    } as any);
  }

  projects.push(
    {
      id: "p2",
      initials: "PA",
      role: "Product Analyst",
      sub: "Candidate not linked · Growth",
      status: "Draft",
      tone: "none",
      candidate: "Candidate not linked",
      progress: "Not planned yet",
      created: "Sep 6, 2026",
      wired: false,
      open: () => {
        set({ screen: "overview", jdOnlyDraft: true });
        say(
          state.lang === "zh"
            ? "草稿项目:尚未关联候选人,所有阶段从总览页开始。"
            : "Draft project — no candidate linked yet; everything starts on Overview.",
        );
      },
    },
    {
      id: "p3",
      initials: "SF",
      role: "Staff Frontend Engineer",
      sub: "Marcus Webb · Design Systems",
      status: "Package published",
      tone: "ok",
      candidate: "Marcus Webb",
      progress: "2 / 2 rounds completed",
      created: "Aug 2, 2026",
      wired: false,
      open: () => {
        set({ screen: "overview", jdOnlyDraft: false, rubricExtracted: true, rubricConfirmed: true, planApproved: true, candidateLinked: true, r1Done: true, r2Done: true, r1Scheduled: true, r2Scheduled: true, decRecorded: true, decision: "Recommend for offer", decHr: true, decHm: true });
        say(
          state.lang === "zh"
            ? "只读项目:评估包已发布,流程不可再编辑。"
            : "Read-only — evaluation package is published; flow is locked.",
        );
      },
    },
    {
      id: "p4",
      initials: "DP",
      role: "Data Platform Engineer",
      sub: "Ravi Shah · Data Infrastructure",
      status: "On hold",
      tone: "none2",
      candidate: "Ravi Shah",
      progress: "1 / 1 rounds completed",
      created: "Aug 5, 2026",
      wired: false,
      open: () => {
        set({ screen: "overview", jdOnlyDraft: false, rubricExtracted: true, rubricConfirmed: true, planApproved: true, candidateLinked: true, r1Done: true, r2Done: false, r1Scheduled: true, r2Scheduled: false });
        say(
          state.lang === "zh"
            ? "项目已暂停:第一轮已完成,等待恢复后才能安排第二轮。"
            : "Project on hold — Round 1 is complete; Round 2 awaits resumption.",
        );
      },
    },
    {
      id: "p5",
      initials: "SE",
      role: "Support Engineer II",
      sub: "Grace Lin · Customer Engineering",
      status: "Not proceeding",
      tone: "bad",
      candidate: "Grace Lin",
      progress: "2 / 2 rounds completed",
      created: "Jul 20, 2026",
      wired: false,
      open: () => {
        set({ screen: "overview", jdOnlyDraft: false, rubricExtracted: true, rubricConfirmed: true, planApproved: true, candidateLinked: true, r1Done: true, r2Done: true, r1Scheduled: true, r2Scheduled: true, decRecorded: true, decision: "Do not proceed", decHr: true, decHm: true });
        say(
          state.lang === "zh"
            ? "已终止:候选人被标记为不推进,所有阶段为只读。"
            : "Closed — candidate marked not proceeding; flow is read-only.",
        );
      },
    },
  );

  return projects;
}

function buildActivity(state: any) {
  const a: { text: string; meta: string }[] = [];
  if (state.offerState === "sent") a.push({ text: "Offer handoff acknowledged", meta: "Senior Backend Engineer · just now" });
  if (state.decRecorded) a.push({ text: "Decision recorded: " + state.decision, meta: "Senior Backend Engineer · just now" });
  if (state.draftCreated) a.push({ text: "New JD-only draft project created", meta: "Senior Backend Engineer · just now" });
  a.push(
    { text: "Offer sync attempted — failed", meta: "Staff Frontend Engineer · 3d ago" },
    { text: "Sarah Chen confirmed the conclusion (HR)", meta: "Senior Backend Engineer · 5d ago" },
    { text: "Debrief reviewed by Sarah Chen", meta: "Senior Backend Engineer · 6d ago" },
    { text: "Priya Nair submitted a scorecard", meta: "Senior Backend Engineer · 10d ago" },
    { text: "Round 2 completed", meta: "Senior Backend Engineer · 10d ago" },
    { text: "David Kim submitted a scorecard", meta: "Senior Backend Engineer · 13d ago" },
    { text: "Round 1 completed", meta: "Senior Backend Engineer · 13d ago" },
    { text: "Rubric confirmed by David Kim", meta: "Senior Backend Engineer · 20d ago" },
    { text: "Project created via manual upload", meta: "Senior Backend Engineer · 22d ago" },
  );
  return a;
}

// Inline icon helpers to avoid extra files
function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z"></path>
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"></path>
      <circle cx="12" cy="17" r=".6" fill="currentColor"></circle>
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="7" width="16" height="13" rx="2"></rect>
      <path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
      <path d="M4 11h16"></path>
    </svg>
  );
}
