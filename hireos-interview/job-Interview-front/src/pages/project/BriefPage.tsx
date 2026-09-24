import { useStore } from "../../store/StoreContext";
import { Pill, compName, type Tone } from "../../utils/status";
import { COMPS } from "../../data/comps";
import { useTask } from "../../features/project-intake/useTask";
import { useBrief } from "../../features/project-intake/useBrief";
import { errorText } from "../../features/project-intake/i18n";

type CardPriority = "Card-P0" | "Card-P1" | "Card-P2";
const PRIORITY_TONE: Record<CardPriority, Tone> = { "Card-P0": "bad", "Card-P1": "warn", "Card-P2": "unknown" };

export function BriefPage() {
  const { state, set, say, evidence, r1Scores, t } = useStore();
  const zh = state.lang === "zh";
  const { task } = useTask(state.currentTaskId);
  const jobId = task?.job.id ?? null;
  const { state: briefState, loading: briefLoading, error: briefError, generate: generateQuestions, reload: reloadBrief } = useBrief(jobId);

  const isGenerating = briefState?.generation?.status === "queued" || briefState?.generation?.status === "parsing";
  const hasConfirmedRubric = !!briefState?.rubricVersionId;
  const stageLabels = zh ? ["背景", "任务", "行动", "结果"] : ["SITUATION", "TASK", "ACTION", "RESULT"];

  const onGenerateQuestions = async () => {
    try { await generateQuestions(); } catch (e) { say(errorText((e as { code?: string }).code || "REQUEST_FAILED", state.lang)); }
  };

  // Built entirely from real fields — candidate name, job title, and whatever the résumé
  // parse actually extracted. Never fabricates experience the AI didn't verifiably find.
  const backgroundSummary = (() => {
    if (!task) return zh ? "加载中…" : "Loading…";
    const applyingFor = zh ? `应聘 ${task.job.title}` : `applying for ${task.job.title}`;
    if (!task.resume) return `${task.candidate.name} — ${applyingFor}. ${zh ? "未附简历。" : "No résumé attached."}`;
    const parsed = task.resume.parseJobs[0];
    const experienceFacts = (parsed?.result?.facts ?? []).filter((f) => f.category === "experience").map((f) => f.value);
    const resumeNote = !parsed || parsed.status === "failed" || parsed.status === "queued" || parsed.status === "parsing"
      ? (zh ? "简历尚未解析完成。" : "Résumé parsing not finished yet.")
      : experienceFacts.length > 0
        ? (zh ? `简历经历：${experienceFacts.slice(0, 2).join("；")}。` : `Résumé experience: ${experienceFacts.slice(0, 2).join("; ")}.`)
        : (zh ? "简历已解析，但未提取到可用的经历信息。" : "Résumé parsed, but no usable experience facts were extracted.");
    return `${task.candidate.name} — ${applyingFor}. ${resumeNote}`;
  })();

  const businessItems = (briefState?.questions ?? []).map((q) => {
    const priority = `Card-${q.card.cardPriority}` as CardPriority;
    const tags = q.card.competencyTags.split(",").map((s) => s.trim()).filter(Boolean);
    const owner = q.card.responsibilityType === "lead" ? (zh ? "招聘经理" : "Hiring Manager") : (zh ? "面试官" : "Interviewer");
    return {
      id: q.id,
      priority,
      requirement: q.card.requirement,
      tags,
      owner,
      mandatory: q.mandatory,
      starQuestions: [q.situationPrompt, q.taskPrompt, q.actionPrompt, q.resultPrompt].map((question, i) => [stageLabels[i], question] as [string, string]),
    };
  });

  const hrItems = [
    {
      title: zh ? "履历完整性" : "Career history integrity",
      detail: zh ? "核实教育经历、证书、工作时间线与履历空档。" : "Verify education, certifications, timeline, and any employment gaps.",
      status: zh ? "待 HR 核实" : "Needs HR verification",
      tone: "warn" as Tone,
      ref: "Résumé",
      open: () => say(evidence.resume?.[0]?.text || ""),
    },
    {
      title: zh ? "求职意愿与约束" : "Motivation & constraints",
      detail: zh ? "确认求职动机、到岗时间、工作地点和期望薪资。" : "Confirm motivation, start date, location constraints, and compensation expectations.",
      status: zh ? "未提供" : "Not provided",
      tone: "unknown" as Tone,
      ref: zh ? "需 HR 提问" : "HR question",
      open: () => say(zh ? "请在 HR 面试中确认求职意愿与约束。" : "Confirm motivation and constraints during the HR interview."),
    },
    {
      title: zh ? "AI 风险提示" : "AI risk flags",
      detail: zh
        ? "简历声称“主导微服务迁移”，但缺少范围和个人贡献，需要人工追问。"
        : "Résumé claims “led migration to microservices” without scope or personal contribution; ask before treating it as evidence.",
      status: zh ? "待核实 Claim" : "Claim to verify",
      tone: "warn" as Tone,
      ref: "Résumé",
      open: () => say(evidence.resume?.[0]?.text || ""),
    },
  ];

  const unknownComps = COMPS.filter((c) => {
    const human = c.round === "r1" ? r1Scores[c.id] ?? null : state.r2Scores[c.id] ?? null;
    return human == null;
  });
  const anyUnknown = unknownComps.length > 0;
  const gapOpen = (state.jdOnlyDraft && !state.candidateLinked) || !state.r1Done || anyUnknown;
  const gapTone: Tone = gapOpen ? "warn" : "ok";
  const gapLabel = state.jdOnlyDraft && !state.candidateLinked
    ? (zh ? "待补充候选人证据" : "Candidate evidence needed")
    : !state.r1Done
      ? (zh ? "待补充面试证据" : "Interview evidence needed")
      : anyUnknown
        ? (zh ? "证据缺口" : "Evidence gap")
        : (zh ? "证据已完整" : "Evidence complete");
  const unknownNote = state.jdOnlyDraft && !state.candidateLinked
    ? (zh ? "六项能力都需要候选人证据。请先关联候选人再排期。" : "All six competencies need candidate evidence. Link a candidate before scheduling.")
    : !state.r1Done
      ? (zh ? "尚无面试证据。请使用计划中的问题验证每项要求。" : "No interview evidence yet. Use the planned questions to verify each requirement.")
      : !state.r2Done
        ? (zh ? "第二轮能力仍待验证：生产责任与事故响应、安全与合规意识、协作与辅导。" : "Round 2 competencies remain open: Production Ownership, Security & Compliance, and Collaboration & Mentorship.")
        : anyUnknown
          ? (zh
              ? unknownComps.map((c) => compName(c, "zh")).join("、") + " 仍需要更强证据。"
              : unknownComps.map((c) => compName(c, "en")).join(", ") + " still need stronger evidence.")
          : (zh ? "当前快照没有开放的证据缺口。" : "No open evidence gaps in the current snapshot.");

  const nextActionHeading = state.jdOnlyDraft && !state.candidateLinked
    ? (zh ? "先关联候选人" : "Link a candidate first")
    : !state.r1Done
      ? (zh ? "完成 Round 1 面试" : "Complete Round 1 interview")
      : (zh ? "复核当前证据" : "Review current evidence");
  const nextActionLabel = state.jdOnlyDraft && !state.candidateLinked
    ? (zh ? "去关联候选人" : "Link candidate")
    : !state.r1Done
      ? (zh ? "开始本轮面试" : "Start this round")
      : (zh ? "进入评审" : "Go to review");
  const nextAction = () => {
    if (state.jdOnlyDraft && !state.candidateLinked) {
      set({ screen: "overview" });
      say(zh ? "请先在项目概览中关联候选人。" : "Link a candidate from the project overview first.");
      return;
    }
    if (!state.r1Done) {
      if (state.jdOnlyDraft && !state.planApproved) { say(zh ? "请先确定面试计划。" : "Approve the interview plan first."); return; }
      if (state.jdOnlyDraft && !state.r1Scheduled && !state.r2Scheduled) { say(zh ? "请先安排一轮面试。" : "Schedule a round before starting the interview."); return; }
      set({ screen: "live" });
      return;
    }
    set({ screen: "review" });
  };
  const focusComps = !state.r1Done
    ? (zh ? "分布式系统设计、后端工程深度、技术沟通" : "Distributed Systems Design, Backend Engineering Depth, Technical Communication")
    : (zh ? "生产责任与事故响应、安全与合规意识、协作与辅导" : "Production Ownership & Incident Response, Security & Compliance Awareness, Collaboration & Mentorship");

  const blocked = state.jdOnlyDraft && (!state.candidateLinked || (!state.r1Scheduled && !state.r2Scheduled));
  const startLive = () => { if (blocked) return; set({ screen: "live" }); };

  return (
    <>
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[17px] py-[15px]">
        <div className="font-mono text-[10.5px] tracking-[0.05em] text-[var(--ink-3)]">{t.backgroundSummary}</div>
        <div className="mt-2 text-[13px] leading-[1.6]">{backgroundSummary}</div>
      </div>

      <div className="rounded-xl border border-[var(--ai)] bg-[var(--ai-soft)] px-[15px] py-3 text-[12.5px] leading-[1.5]">
        {t.briefRoleIntro}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-[15px]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--brand)] text-[12px] font-extrabold text-[var(--brand-ink)]">BI</span>
                <div className="text-sm font-bold">{t.businessLaneTitle}</div>
                {briefState?.versionNumber != null && (
                  <div className="inline-flex h-[22px] items-center whitespace-nowrap rounded-md bg-[var(--surface-3)] px-2 text-[11px] font-semibold text-[var(--ink-2)]">
                    {t.rubricVersionLabel}{briefState.versionNumber}
                  </div>
                )}
              </div>
              <div className="mt-[7px] text-xs leading-[1.45] text-[var(--ink-2)]">{t.businessLaneSubtitle}</div>
            </div>
            <div className="flex flex-col gap-2.5 px-4 py-[13px]">
              {!jobId && (
                <div className="px-1 py-2 text-xs text-[var(--ink-3)]">{zh ? "未找到关联的岗位。" : "No linked job found."}</div>
              )}
              {jobId && !briefLoading && !hasConfirmedRubric && (
                <div className="rounded-[10px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-4 text-center">
                  <div className="text-xs text-[var(--ink-2)]">{zh ? "请先在「要求与评分标准」中确认评分标准。" : "Confirm the rubric on Requirements & Rubric first."}</div>
                  <button onClick={() => set({ screen: "rubric" })} className="mt-2.5 cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[var(--brand)] underline">
                    {zh ? "前往要求与评分标准" : "Go to Requirements & Rubric"}
                  </button>
                </div>
              )}
              {jobId && hasConfirmedRubric && businessItems.length === 0 && !isGenerating && (
                <div className="rounded-[10px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-4 text-center">
                  <div className="text-xs text-[var(--ink-2)]">{zh ? "尚未生成面试提要问题。" : "Interview Brief questions haven't been generated yet."}</div>
                  <button onClick={onGenerateQuestions} className="mt-2.5 h-8 cursor-pointer rounded-[9px] border border-[var(--brand)] bg-[var(--brand)] px-3 text-[12px] font-semibold text-[var(--brand-ink)]">
                    {zh ? "生成面试提要" : "Generate Interview Brief"}
                  </button>
                </div>
              )}
              {isGenerating && (
                <div className="px-1 py-2 text-xs text-[var(--ink-3)]">{zh ? "正在生成面试提要问题…" : "Generating Interview Brief questions…"}</div>
              )}
              {briefState?.generation?.status === "failed" && (
                <div className="rounded-[10px] border border-[var(--bad)] bg-[var(--bad-soft)] p-3 text-xs text-[var(--ink)]">
                  {errorText(briefState.generation.errorCode || "REQUEST_FAILED", state.lang)}{" "}
                  <button onClick={onGenerateQuestions} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--brand)] underline">{zh ? "重试" : "Retry"}</button>
                </div>
              )}
              {!!briefError && (
                <div className="px-1 py-2 text-xs text-[var(--ink-3)]">
                  {errorText(briefError, state.lang)}{" "}
                  <button onClick={reloadBrief} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--brand)] underline">{zh ? "重试" : "Retry"}</button>
                </div>
              )}
              {businessItems.map((item) => (
                <div key={item.id} className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3">
                  <div className="flex items-center gap-2">
                    <Pill label={item.priority} tone={PRIORITY_TONE[item.priority]} />
                    <div className="flex-1 text-[13px] font-semibold">{item.requirement}</div>
                  </div>
                  {item.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <div key={tag} className="rounded-md border border-[var(--line)] px-2 py-[3px] text-[11px] text-[var(--ink-2)]">{tag}</div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 rounded-lg bg-[var(--surface-2)] px-2.5 py-2 text-[11.5px] leading-[1.45] text-[var(--ink-2)]">
                    <span className="font-semibold text-[var(--ink-3)]">{t.candidateEvidenceLabel}: </span>
                    {zh ? "尚未接入候选人简历匹配。" : "Candidate résumé matching isn't wired up yet."}
                  </div>
                  <div className="mt-2 rounded-lg bg-[var(--surface-2)] px-2.5 py-2.5">
                    <div className="font-mono text-[10.5px] font-bold tracking-[0.04em] text-[var(--ink-3)]">{t.suggestedQuestionsLabel}</div>
                    {item.starQuestions.map(([stage, question], i) => (
                      <div key={i} className="mt-[7px] flex items-start gap-2">
                        <span className="min-w-[52px] flex-none text-[10.5px] font-bold text-[var(--brand)]">{stage}</span>
                        <span className="flex-1 text-[11.5px] text-[var(--ink-2)]">{question}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-3)]">
                    <span>{t.ownerLabel}: {item.owner}</span>
                    <button
                      onClick={() => set({ screen: "rubric" })}
                      className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[var(--brand)] underline"
                    >
                      {zh ? "在评分标准中查看" : "View in rubric"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-[15px]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[var(--brand-soft)] text-[12px] font-extrabold text-[var(--brand)]">HR</span>
                <div className="text-sm font-bold">{t.hrLaneTitle}</div>
              </div>
              <div className="mt-[7px] text-xs leading-[1.45] text-[var(--ink-2)]">{t.hrLaneSubtitle}</div>
            </div>
            <div className="flex flex-col gap-[11px] px-4 py-[13px]">
              {hrItems.map((item, i) => (
                <div key={i} className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 text-[13px] font-semibold">{item.title}</div>
                    <Pill label={item.status} tone={item.tone} />
                  </div>
                  <div className="mt-1.5 text-xs leading-[1.5] text-[var(--ink-2)]">{item.detail}</div>
                  <button onClick={item.open} className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[var(--brand)] underline">
                    {item.ref}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={"overflow-hidden rounded-[14px] border " + (gapOpen ? "border-[var(--warn)] bg-[var(--warn-soft)]" : "border-[var(--ok)] bg-[var(--ok-soft)]")}>
            <div className="ml-[15px] mt-[11px]">
              <Pill label={gapLabel} tone={gapTone} />
            </div>
            <div className="px-4 pb-[15px] pt-2.5 text-[12.5px] leading-[1.55]">{unknownNote}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] px-[13px] py-3">
            <div className="font-mono text-[10px] tracking-[0.05em] text-[var(--ink-3)]">{t.recommendedFocus}</div>
            <div className="min-w-[180px] flex-1 text-xs">
              <b>{nextActionHeading}</b>
              <div className="mt-[3px] leading-[1.4] text-[var(--ink-2)]">{focusComps}</div>
            </div>
            <button onClick={() => set({ screen: "plan" })} className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[var(--brand)] underline">
              {t.viewPlanArrow}
            </button>
            <button
              onClick={nextAction}
              className="h-[30px] cursor-pointer whitespace-nowrap rounded-lg border border-[var(--brand)] bg-[var(--brand)] px-[11px] text-[11.5px] font-semibold text-[var(--brand-ink)]"
            >
              {nextActionLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-[13px]">
        <div className="flex-1" />
        <button onClick={() => set({ screen: "schedule" })} className="h-[34px] cursor-pointer rounded-[11px] border border-transparent bg-transparent px-3 text-[12.5px] text-[var(--ink-2)]">
          {t.backToSchedule}
        </button>
        <button
          disabled={blocked}
          onClick={startLive}
          className={
            "h-[34px] cursor-pointer rounded-[11px] border px-[15px] text-[12.5px] font-semibold " +
            (blocked ? "cursor-not-allowed border-[var(--line)] bg-[var(--surface-3)] text-[var(--ink-3)]" : "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]")
          }
        >
          {blocked ? (zh ? "请先完成前置步骤" : "Complete setup before interview") : t.startLiveInterview}
        </button>
      </div>
    </>
  );
}
