import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/StoreContext";
import { flowGateReason } from "../utils/flowGate";
import type { Task } from "../features/project-intake/api";

export function FlowNav({ task }: { task: Task | null }) {
  const { state, go, set, say, t } = useStore();
  const navRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const flowIds = ["overview", "rubric", "plan", "schedule", "brief", "live", "review", "debrief", "decision", "package"] as const;
  const flowLabels: Record<string, string> = {
    overview: t.navOverview,
    rubric: t.navRubric,
    plan: t.navPlan,
    schedule: t.navSchedule,
    brief: t.navBrief,
    live: t.navLive,
    review: t.navReview,
    debrief: t.navDebrief,
    decision: t.navDecision,
    package: t.navPackage,
  };

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const updateOverflow = () => setOverflow({
      start: nav.scrollLeft > 1,
      end: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1,
    });
    updateOverflow();
    nav.addEventListener("scroll", updateOverflow, { passive: true });
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(nav);
    return () => {
      nav.removeEventListener("scroll", updateOverflow);
      observer.disconnect();
    };
  }, []);

  const scrollBy = (amount: number) => navRef.current?.scrollBy({ left: amount, behavior: "smooth" });

  return (
    <div className="flow-nav-shell" role="navigation" aria-label={t.interviewProjectNav}>
      <div className="flow-nav-row">
        <button
          type="button"
          className="flow-nav-scroll"
          aria-label={state.lang === "zh" ? "查看前面的步骤" : "Show earlier steps"}
          title={state.lang === "zh" ? "查看前面的步骤" : "Show earlier steps"}
          disabled={!overflow.start}
          onClick={() => scrollBy(-260)}
        >
          ‹
        </button>
        <div ref={navRef} className="flow-nav" tabIndex={0}>
          {flowIds.map((id) => {
        const active = state.screen === id;
        // Live Interview is entered only through Brief's "Start this round" (which picks the
        // round), never straight from the tab.
        const lockedReason = flowGateReason(task, id, state.lang === "zh")
          ?? (id === "live" && !active
            ? (state.lang === "zh" ? "请在「面试提要」底部点击「开始本轮面试」进入。" : "Open Live Interview from “Start this round” at the bottom of Interview Brief.")
            : null);
        return (
          <button
            key={id}
            type="button"
            title={lockedReason ?? undefined}
            aria-disabled={!!lockedReason}
            aria-current={active ? "step" : undefined}
            onClick={() => {
              if (lockedReason) { say(lockedReason); return; }
              // The checks below only gate the fully-simulated demo flow; a real task is
              // gated entirely by its backend stages above.
              if (task) { go(id as any); return; }
              if (state.jdOnlyDraft && id === "plan" && !state.rubricConfirmed) {
                say(
                  state.lang === "zh"
                    ? "请先确认评分标准，再规划面试。"
                    : "Confirm the rubric before planning interviews.",
                );
                return;
              }
              if (state.jdOnlyDraft && id === "schedule" && !state.planApproved) {
                say(
                  state.lang === "zh"
                    ? "请先批准面试计划，再进行排期。"
                    : "Approve the interview plan before scheduling.",
                );
                return;
              }
              if (
                state.jdOnlyDraft &&
                ["brief", "live"].includes(id) &&
                !state.candidateLinked
              ) {
                say(
                  state.lang === "zh"
                    ? "请先关联候选人，再打开面向候选人的面试步骤。"
                    : "Link a candidate before opening candidate-facing interview steps.",
                );
                return;
              }
              if (
                state.jdOnlyDraft &&
                id === "live" &&
                !state.r1Scheduled &&
                !state.r2Scheduled
              ) {
                say(
                  state.lang === "zh"
                    ? "请先为至少一轮面试排期，再开始实时面试。"
                    : "Schedule a round before starting the live interview.",
                );
                return;
              }
              go(id as any);
            }}
            style={{
              flex: "none",
              height: 38,
              padding: "0 13px",
              border: 0,
              borderBottom: `2px solid ${active ? "var(--brand)" : "transparent"}`,
              background: "transparent",
              color: active ? "var(--brand)" : lockedReason ? "var(--ink-3)" : "var(--ink-2)",
              fontSize: 12.5,
              fontWeight: active ? 600 : 500,
              cursor: lockedReason ? "not-allowed" : "pointer",
              opacity: lockedReason ? 0.55 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {flowLabels[id]}
          </button>
          );
          })}
        </div>
        <button
          type="button"
          className="flow-nav-scroll"
          aria-label={state.lang === "zh" ? "查看后面的步骤" : "Show later steps"}
          title={state.lang === "zh" ? "查看后面的步骤" : "Show later steps"}
          disabled={!overflow.end}
          onClick={() => scrollBy(260)}
        >
          ›
        </button>
      </div>
      {(overflow.start || overflow.end) && (
        <div className="flow-nav-hint" aria-live="polite">
          {state.lang === "zh" ? "还有步骤，可横向滚动查看" : "More steps available — scroll horizontally"}
        </div>
      )}
    </div>
  );
}
