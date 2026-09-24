import { useStore } from "../../store/StoreContext";
import { Pill, compName } from "../../utils/status";
import { Banner } from "../../components/ui/Primitives";
import { COMPS } from "../../data/comps";

export function ProjectOverviewPage() {
  const { state, t, set, go, role } = useStore();

  const overviewMaterials = state.jdOnlyDraft
    ? [
        { name: "Job Description", tag: "Provided", tone: "ok", hasAction: false },
        {
          name: "Résumé",
          tag: state.candidateLinked ? "Provided" : "Not provided",
          tone: state.candidateLinked ? "ok" : "none",
          hasAction: false,
        },
        { name: "Screening package", tag: "Not provided", tone: "none", hasAction: false },
        { name: "Assessment results", tag: "Not provided", tone: "none", hasAction: false },
      ]
    : [
        { name: "Job Description", tag: "Provided", tone: "ok", hasAction: false },
        { name: "Résumé", tag: "Provided", tone: "ok", hasAction: false },
        {
          name: "Screening package",
          tag: state.dupResolved ? "Resolved" : "Duplicate",
          tone: state.dupResolved ? "ok" : "warn",
          hasAction: !state.dupResolved,
          actionLabel: "Resolve",
        },
        { name: "Assessment results", tag: "Provided", tone: "ok", hasAction: false },
        {
          name: "Unlabeled attachment",
          tag: state.triResolved ? "Matched" : "Needs triage",
          tone: state.triResolved ? "ok" : "warn",
          hasAction: !state.triResolved,
          actionLabel: "Triage",
        },
      ];

  const overviewRounds =
    state.jdOnlyDraft && !state.rubricConfirmed
      ? []
      : [
          {
            name: "Round 1 — System Design & Architecture",
            meta: state.r1Done
              ? state.jdOnlyDraft
                ? "Completed just now · David Kim"
                : "Aug 26, 2:00 PM UTC+8 · David Kim"
              : state.r1Scheduled
                ? "Sep 15, 10:00 AM UTC+8 · David Kim"
                : "Not scheduled · David Kim",
            status: state.r1Done ? "completed" : state.r1Scheduled ? "Scheduled" : "Planned",
          },
          {
            name: "Round 2 — Technical Deep Dive & Collaboration",
            meta: state.r2Done
              ? state.jdOnlyDraft
                ? "Completed just now · Priya Nair"
                : "Aug 29, 3:30 PM UTC+8 · Priya Nair"
              : state.r2Scheduled
                ? "Sep 17, 3:30 PM UTC+8 · Priya Nair"
                : "Not scheduled · Priya Nair",
            status: state.r2Done ? "completed" : state.r2Scheduled ? "Scheduled" : "Planned",
          },
        ];

  const overviewPeople = [
    { initials: "SC", name: "Sarah Chen", role: "HR Partner" },
    { initials: "DK", name: "David Kim", role: "Hiring Manager" },
    { initials: "PN", name: "Priya Nair", role: "Interviewer, Round 2" },
  ];

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
                  set({ toast: state.lang === "zh" ? "已将 Elena Torres 关联为该项目候选人。" : "Elena Torres linked as the candidate for this project." });
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
                {state.lang === "zh" ? "关联候选人" : "Link candidate"}
              </button>
            )
          }
        >
          {!state.rubricExtracted
            ? state.lang === "zh"
              ? "草稿项目。当前只有 JD，候选人未关联，要求尚未从 JD 中提取。"
              : "Draft project. Only the JD is in — no candidate is linked and requirements have not been extracted yet."
            : !state.rubricConfirmed
              ? "Requirements are ready for review. Confirm the rubric before planning interviews."
              : !state.candidateLinked
                ? "Rubric confirmed. Link a candidate before scheduling or starting an interview."
                : !state.planApproved
                  ? "Candidate linked. Approve the interview plan before scheduling."
                  : "Project setup is ready."}
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
            Awaiting confirmation. {state.decHr ? "Sarah Chen (HR) has confirmed." : "Sarah Chen (HR) has not confirmed yet."} Waiting on Hiring Manager.{" "}
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
              ? state.lang === "zh"
                ? "只需要 JD 即可启动项目。其他资料可以现在或以后再链接，不会阻塞项目建立。"
                : "A JD alone is enough to start. Other materials can be linked now or later; missing ones never block project creation."
              : "Created via folder import on Aug 18, 2026. Missing items never block this project — they show as Unknown."}
          </div>
        </OverviewCard>

        <OverviewCard title={t.overviewReqCoverage}>
          {state.jdOnlyDraft && !state.rubricExtracted ? (
            <div style={{ padding: "11px 16px", fontSize: 13, color: "var(--ink-3)" }}>
              {state.lang === "zh" ? "尚未从 JD 中提取要求" : "Requirements have not been extracted from the JD yet"}
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
                  label={c.must ? "Must-have" : "Standard"}
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
              {state.planMode === "all" ? "Planned all at once" : "One round at a time"}
            </div>
          }
        >
          {overviewRounds.length === 0 ? (
            <div style={{ padding: "11px 16px", fontSize: 13, color: "var(--ink-3)" }}>
              {state.lang === "zh" ? "尚未规划轮次" : "No rounds planned yet"}
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
                  label={r.status}
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
