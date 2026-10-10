import { useStore } from "../../store/StoreContext";
import { Pill, type Tone } from "../../utils/status";
import { Banner } from "../../components/ui/Primitives";
import { useProjectTask } from "../../features/project-intake/useTask";
import { useDebriefSummary } from "../../features/project-intake/useDebriefSummary";
import type { Screen } from "../../store/types";

const row = { padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 } as const;
const emptyRow = { padding: "11px 16px", fontSize: 13, color: "var(--ink-3)" } as const;

export function ProjectOverviewPage() {
  const { state, t, go } = useStore();
  const zh = state.lang === "zh";
  const L = (en: string, zhText: string) => (zh ? zhText : en);
  const { task, advance } = useProjectTask();
  const summary = useDebriefSummary(state.currentTaskId);

  if (!task) return <div style={emptyRow}>{L("Loading…", "加载中…")}</div>;

  const fmt = (iso: string, withTime = true) =>
    new Date(iso).toLocaleString(zh ? "zh-CN" : "en-US", withTime
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" });

  // Source materials — the JD, the résumé and whatever was attached to this task, by kind.
  const readTag = (readStatus: string | undefined): { tag: string; tone: Tone } =>
    readStatus === "available" ? { tag: L("Provided", "已提供"), tone: "ok" }
      : readStatus === "failed" ? { tag: L("Unreadable", "读取失败"), tone: "bad" }
        : { tag: L("Processing", "处理中"), tone: "warn" };
  const attached = (kind: string) => task.materials.filter((m) => m.kind === kind);
  const materialRow = (name: string, kind: string) => {
    const items = attached(kind);
    if (!items.length) return { name, tag: L("Not provided", "未提供"), tone: "unknown" as Tone };
    const worst = items.find((m) => m.material.readStatus !== "available") ?? items[0];
    const { tag, tone } = readTag(worst.material.readStatus);
    return { name: items.length > 1 ? `${name} ×${items.length}` : name, tag, tone };
  };
  const materials = [
    { name: L("Job Description", "职位描述（JD）"), ...(task.job.jdText.trim() ? { tag: L("Provided", "已提供"), tone: "ok" as Tone } : { tag: L("Not provided", "未提供"), tone: "unknown" as Tone }) },
    task.resume ? { name: L("Résumé", "简历"), ...readTag(task.resume.material.readStatus) } : { name: L("Résumé", "简历"), tag: L("Not provided", "未提供"), tone: "unknown" as Tone },
    materialRow(L("Screening package", "初筛资料包"), "screening"),
    materialRow(L("Assessment results", "测评结果"), "assessment"),
    ...(attached("other").length ? [materialRow(L("Other attachments", "其他附件"), "other")] : []),
  ];

  // Requirement coverage — each confirmed capability card with its latest human score.
  const coverage = (score: number | null, bar: number): { tag: string; tone: Tone } =>
    score == null ? { tag: L("Not verified", "待验证"), tone: "unknown" }
      : score >= bar ? { tag: `L${score} · ${L("Meets bar", "达标")}`, tone: "ok" }
        : { tag: `L${score} · ${L("Below bar", "未达标")}`, tone: "warn" };

  // Rounds and the people on them.
  const roundStatus = (r: (typeof task.rounds)[number]): { tag: string; tone: Tone } =>
    r.status === "completed" ? { tag: L("Completed", "已完成"), tone: "ok" }
      : r.scheduledAt ? { tag: L("Scheduled", "已排期"), tone: "warn" }
        : { tag: L("Planned", "已规划"), tone: "unknown" };
  const roundMeta = (r: (typeof task.rounds)[number]) => [
    r.completedAt ? `${L("Completed", "完成于")} ${fmt(r.completedAt)}`
      : r.scheduledAt ? `${fmt(r.scheduledAt)} ${r.timezone ?? ""}`.trim()
        : L("Not scheduled", "未排期"),
    r.interviewer?.name ?? L("No interviewer yet", "未指定面试官"),
  ].join(" · ");
  const interviewers = new Map<string, { name: string; title: string | null; rounds: number[] }>();
  for (const r of task.rounds) {
    if (!r.interviewer) continue;
    const entry = interviewers.get(r.interviewer.id) ?? { name: r.interviewer.name, title: r.interviewer.title, rounds: [] };
    entry.rounds.push(r.sequence);
    interviewers.set(r.interviewer.id, entry);
  }
  const initials = (name: string) => name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const people = [
    { initials: initials(task.candidate.name), name: task.candidate.name, role: L("Candidate", "候选人") },
    ...[...interviewers.values()].map((p) => ({
      initials: initials(p.name), name: p.name,
      role: [p.title, zh ? `第 ${p.rounds.join("、")} 轮面试官` : `Interviewer, round ${p.rounds.join(", ")}`].filter(Boolean).join(" · "),
    })),
  ];

  // Banner: the package waiting on sign-off, otherwise the first unfinished stage.
  const stageLabel: Record<string, string> = {
    rubric: t.navRubric, plan: t.navPlan, schedule: t.navSchedule, brief: t.navBrief, live: t.navLive,
    review: t.navReview, debrief: t.navDebrief, decision: t.navDecision, package: t.navPackage,
  };
  const next = task.stages.find((s) => s.stage !== "overview" && s.stage !== "package" && !s.done);
  const awaitingSignOff = task.status === "awaiting_confirmation";
  const planConfirmed = !!task.stages.find((s) => s.stage === "plan")?.done;

  return (
    <>
      {awaitingSignOff ? (
        <Banner tone="warn">
          <span>⏱</span>
          <div style={{ flex: 1 }}>
            {L("Awaiting confirmation.", "等待确认。")}{" "}
            {task.hrConfirmedAt ? L("HR has confirmed.", "HR 已确认。") : L("HR has not confirmed yet.", "HR 尚未确认。")}{" "}
            {task.hmConfirmedAt ? L("Hiring Manager has confirmed.", "招聘经理已确认。") : L("Waiting on Hiring Manager.", "等待招聘经理确认。")}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); go("package"); }} style={{ textDecoration: "underline" }}>
              {L("Go to Evaluation Package →", "前往评估包 →")}
            </a>
          </div>
        </Banner>
      ) : next && (
        <Banner tone="brand">
          <div style={{ flex: 1 }}>
            {L("Next step: ", "下一步：")}<b>{stageLabel[next.stage]}</b>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); void advance(next.stage as Screen); }} style={{ textDecoration: "underline" }}>
            {L("Open →", "前往 →")}
          </a>
        </Banner>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <OverviewCard title={t.overviewSourceMaterials}>
          {materials.map((m, i) => (
            <div key={i} style={row}>
              <div style={{ flex: 1, fontSize: 13 }}>{m.name}</div>
              <Pill label={m.tag} tone={m.tone} />
            </div>
          ))}
          <div style={{ padding: "11px 16px", fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45 }}>
            {L(`Created ${fmt(task.createdAt, false)}. Missing materials never block this project.`, `创建于 ${fmt(task.createdAt, false)}。缺失的资料不会阻塞此项目。`)}
          </div>
        </OverviewCard>

        <OverviewCard
          title={t.overviewReqCoverage}
          extra={summary && summary.mustHaveTotal > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              {L(`Must-haves met ${summary.mustHaveMet} / ${summary.mustHaveTotal}`, `必须项达标 ${summary.mustHaveMet} / ${summary.mustHaveTotal}`)}
            </div>
          )}
        >
          {!summary ? (
            <div style={emptyRow}>{L("Loading…", "加载中…")}</div>
          ) : summary.totalCards === 0 ? (
            <div style={emptyRow}>{L("The rubric hasn't been confirmed yet", "评分标准尚未确认")}</div>
          ) : (
            summary.cards.map((c) => {
              const cov = coverage(c.score, summary.bar);
              return (
                <div key={c.id} style={{ ...row, padding: "11px 16px" }}>
                  <div style={{ flex: 1, fontSize: 13 }}>{c.requirement}</div>
                  {c.cardPriority === "P0" && <Pill label={L("Must-have", "必须项")} tone="bad" />}
                  <Pill label={cov.tag} tone={cov.tone} />
                </div>
              );
            })
          )}
        </OverviewCard>

        <OverviewCard
          title={t.overviewInterviewRounds}
          extra={
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              {planConfirmed ? L("Plan confirmed", "计划已确定") : L("Plan not confirmed", "计划未确定")}
            </div>
          }
        >
          {task.rounds.length === 0 ? (
            <div style={emptyRow}>{L("No rounds planned yet", "尚未规划轮次")}</div>
          ) : (
            task.rounds.map((r) => {
              const st = roundStatus(r);
              return (
                <div key={r.id} style={row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-3)" }}>{roundMeta(r)}</div>
                  </div>
                  <Pill label={st.tag} tone={st.tone} />
                </div>
              );
            })
          )}
        </OverviewCard>

        <OverviewCard title={t.overviewPeopleHeader}>
          {people.map((p, i) => (
            <div key={i} style={row}>
              <div
                style={{
                  flex: "none",
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  background: "var(--surface-3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ink-2)",
                }}
              >
                {p.initials}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{p.role}</div>
              </div>
            </div>
          ))}
          {interviewers.size === 0 && (
            <div style={{ ...emptyRow, fontSize: 11.5 }}>{L("No interviewers assigned to any round yet.", "各轮次尚未指定面试官。")}</div>
          )}
        </OverviewCard>
      </div>
    </>
  );
}

function OverviewCard({
  title,
  children,
  extra,
}: {
  title: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
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
          padding: "13px 16px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 9,
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
          {title}
        </div>
        {extra}
      </div>
      {children}
    </div>
  );
}
