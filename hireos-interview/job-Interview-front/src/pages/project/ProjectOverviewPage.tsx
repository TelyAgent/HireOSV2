import { useStore } from "../../store/StoreContext";
import { Pill, compName } from "../../utils/status";
import { Banner } from "../../components/ui/Primitives";
import { COMPS } from "../../data/comps";

export function ProjectOverviewPage() {
  const { state, t, set, say, go, role } = useStore();
  const zh = state.lang === "zh";
  const L = (en: string, zhText: string) => (zh ? zhText : en);

  const overviewMaterials = state.jdOnlyDraft
    ? [
        { name: L("Job Description", "职位描述（JD）"), tag: L("Provided", "已提供"), tone: "ok", hasAction: false },
        {
          name: L("Résumé", "简历"),
          tag: state.candidateLinked ? L("Provided", "已提供") : L("Not provided", "未提供"),
          tone: state.candidateLinked ? "ok" : "none",
          hasAction: false,
        },
        { name: L("Screening package", "初筛资料包"), tag: L("Not provided", "未提供"), tone: "none", hasAction: false },
        { name: L("Assessment results", "测评结果"), tag: L("Not provided", "未提供"), tone: "none", hasAction: false },
      ]
    : [
        { name: L("Job Description", "职位描述（JD）"), tag: L("Provided", "已提供"), tone: "ok", hasAction: false },
        { name: L("Résumé", "简历"), tag: L("Provided", "已提供"), tone: "ok", hasAction: false },
        {
          name: L("Screening package", "初筛资料包"),
          tag: state.dupResolved ? L("Resolved", "已处理") : L("Duplicate", "重复"),
          tone: state.dupResolved ? "ok" : "warn",
          hasAction: !state.dupResolved,
          actionLabel: L("Resolve", "处理"),
        },
        { name: L("Assessment results", "测评结果"), tag: L("Provided", "已提供"), tone: "ok", hasAction: false },
        {
          name: L("Unlabeled attachment", "未标记附件"),
          tag: state.triResolved ? L("Matched", "已匹配") : L("Needs triage", "待分类"),
          tone: state.triResolved ? "ok" : "warn",
          hasAction: !state.triResolved,
          actionLabel: L("Triage", "分类"),
        },
      ];

  const overviewRounds =
    state.jdOnlyDraft && !state.rubricConfirmed
      ? []
      : [
          {
            name: L("Round 1 — System Design & Architecture", "第 1 轮 — 系统设计与架构"),
            meta: state.r1Done
              ? state.jdOnlyDraft
                ? L("Completed just now · David Kim", "刚刚完成 · David Kim")
                : L("Aug 26, 2:00 PM UTC+8 · David Kim", "8月26日 14:00 UTC+8 · David Kim")
              : state.r1Scheduled
                ? L("Sep 15, 10:00 AM UTC+8 · David Kim", "9月15日 10:00 UTC+8 · David Kim")
                : L("Not scheduled · David Kim", "未排期 · David Kim"),
            status: state.r1Done ? "completed" : state.r1Scheduled ? "Scheduled" : "Planned",
          },
          {
            name: L("Round 2 — Technical Deep Dive & Collaboration", "第 2 轮 — 技术深挖与协作"),
            meta: state.r2Done
              ? state.jdOnlyDraft
                ? L("Completed just now · Priya Nair", "刚刚完成 · Priya Nair")
                : L("Aug 29, 3:30 PM UTC+8 · Priya Nair", "8月29日 15:30 UTC+8 · Priya Nair")
              : state.r2Scheduled
                ? L("Sep 17, 3:30 PM UTC+8 · Priya Nair", "9月17日 15:30 UTC+8 · Priya Nair")
                : L("Not scheduled · Priya Nair", "未排期 · Priya Nair"),
            status: state.r2Done ? "completed" : state.r2Scheduled ? "Scheduled" : "Planned",
          },
        ];

  const overviewPeople = [
    { initials: "SC", name: "Sarah Chen", role: L("HR Partner", "HR 伙伴") },
    { initials: "DK", name: "David Kim", role: L("Hiring Manager", "招聘经理") },
    { initials: "PN", name: "Priya Nair", role: L("Interviewer, Round 2", "第 2 轮面试官") },
  ];

  const roundStatusLabel = (status: string) =>
    status === "completed" ? L("Completed", "已完成") : status === "Scheduled" ? L("Scheduled", "已排期") : L("Planned", "已规划");

  const draftBanner = state.jdOnlyDraft && (!state.rubricConfirmed || !state.candidateLinked || !state.planApproved);
  const evidencePending = state.followUpRounds.some((r) => r.status !== "completed");
  const confirmBanner = !state.decRecorded && !!state.decision && !evidencePending;

  return (
    <>
      {draftBanner && (
        <Banner
          tone="brand"
          actions={
            !state.candidateLinked && (
              <button
                onClick={() => {
                  set({ candidateLinked: true });
                  say(zh ? "已将 Elena Torres 关联为该项目候选人。" : "Elena Torres linked as the candidate for this project.");
                }}
                style={{
                  height: 32,
                  padding: "0 12px",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 9,
                  background: "var(--surface)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {L("Link candidate", "关联候选人")}
              </button>
            )
          }
        >
          {!state.rubricExtracted
            ? L("Draft project. Only the JD is in — no candidate is linked and requirements have not been extracted yet.", "草稿项目。当前只有 JD，候选人未关联，要求尚未从 JD 中提取。")
            : !state.rubricConfirmed
              ? L("Requirements are ready for review. Confirm the rubric before planning interviews.", "要求已可审阅。请先确认评分标准，再规划面试。")
              : !state.candidateLinked
                ? L("Rubric confirmed. Link a candidate before scheduling or starting an interview.", "评分标准已确认。排期或开始面试前，请先关联候选人。")
                : !state.planApproved
                  ? L("Candidate linked. Approve the interview plan before scheduling.", "候选人已关联。排期前请先确认面试计划。")
                  : L("Project setup is ready.", "项目设置已就绪。")}
        </Banner>
      )}
      {confirmBanner && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "11px 14px",
            border: "1px solid var(--warn)",
            borderRadius: 12,
            background: "var(--warn-soft)",
          }}
        >
          <span>⏱</span>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            {L("Awaiting confirmation.", "等待确认。")}{" "}
            {state.decHr
              ? L("Sarah Chen (HR) has confirmed.", "Sarah Chen（HR）已确认。")
              : L("Sarah Chen (HR) has not confirmed yet.", "Sarah Chen（HR）尚未确认。")}{" "}
            {L("Waiting on Hiring Manager.", "等待招聘经理确认。")}{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                go("decision");
              }}
              style={{ textDecoration: "underline" }}
            >
              {t.goToDecisionFull}
            </a>
          </div>
        </div>
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
          {overviewMaterials.map((m, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ flex: 1, fontSize: 13 }}>{m.name}</div>
              <Pill label={m.tag} tone={m.tone as any} />
            </div>
          ))}
          <div
            style={{
              padding: "11px 16px",
              fontSize: 11.5,
              color: "var(--ink-3)",
              lineHeight: 1.45,
            }}
          >
            {state.jdOnlyDraft
              ? L("A JD alone is enough to start. Other materials can be linked now or later; missing ones never block project creation.", "只需要 JD 即可启动项目。其他资料可以现在或以后再链接，不会阻塞项目建立。")
              : L("Created via folder import on Aug 18, 2026. Missing items never block this project — they show as Unknown.", "于 2026 年 8 月 18 日通过文件夹导入创建。缺失的资料不会阻塞此项目，会显示为「未知」。")}
          </div>
        </OverviewCard>

        <OverviewCard title={t.overviewReqCoverage}>
          {state.jdOnlyDraft && !state.rubricExtracted ? (
            <div style={{ padding: "11px 16px", fontSize: 13, color: "var(--ink-3)" }}>
              {L("Requirements have not been extracted from the JD yet", "尚未从 JD 中提取要求")}
            </div>
          ) : (
            COMPS.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: "11px 16px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, fontSize: 13 }}>{compName(c, state.lang)}</div>
                <Pill
                  label={c.must ? L("Must-have", "必须项") : L("Standard", "标准项")}
                  tone={c.must ? "bad" : "unknown"}
                />
              </div>
            ))
          )}
        </OverviewCard>

        <OverviewCard
          title={t.overviewInterviewRounds}
          extra={
            <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
              {state.planMode === "all" ? L("Planned all at once", "一次性规划") : L("One round at a time", "逐轮规划")}
            </div>
          }
        >
          {overviewRounds.length === 0 ? (
            <div style={{ padding: "11px 16px", fontSize: 13, color: "var(--ink-3)" }}>
              {L("No rounds planned yet", "尚未规划轮次")}
            </div>
          ) : (
            overviewRounds.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-3)" }}>
                    {r.meta}
                  </div>
                </div>
                <Pill
                  label={roundStatusLabel(r.status)}
                  tone={r.status === "completed" ? "ok" : "warn"}
                />
              </div>
            ))
          )}
        </OverviewCard>

        <OverviewCard title={t.overviewPeopleHeader}>
          {overviewPeople.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
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
