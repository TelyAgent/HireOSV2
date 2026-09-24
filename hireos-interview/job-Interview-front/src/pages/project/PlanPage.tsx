import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { useStore } from "../../store/StoreContext";
import { Pill } from "../../utils/status";
import { PlusSvg, CloseSvg, ChevronSvg } from "../../components/ui/Icons";
import { api, type ApiError, type Interviewer, type Round } from "../../features/project-intake/api";
import { errorText } from "../../features/project-intake/i18n";

const FORMAT_OPTIONS = ["Onsite panel", "Video interview", "1:1 interview", "Work sample"];
const DURATION_OPTIONS = [30, 45, 50, 60, 90];

type RoundDraft = {
  name: string; format: string; duration: number; competencies: string;
  questions: number; mandatory: number; notes: string; interviewerId: string;
  status: "Planned" | "completed";
};
const emptyDraft = (): RoundDraft => ({
  name: "", format: "Video interview", duration: 45, competencies: "",
  questions: 3, mandatory: 2, notes: "", interviewerId: "", status: "Planned",
});

const fieldLabel = "mb-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]";
const fieldInput = "h-10 w-full rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60";
const fieldTextarea = "w-full resize-y rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] py-2.5 text-[12.5px] leading-[1.5] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60";

export function PlanPage() {
  const { state, set, say, t } = useStore();
  const zh = state.lang === "zh";
  const taskId = state.currentTaskId;

  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [openRoundId, setOpenRoundId] = useState<string | null>(null); // "new" while creating
  const [draft, setDraft] = useState<RoundDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api<Interviewer[]>("/interviewers").then((rows) => { if (active) setInterviewers(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const loadRounds = () => {
    if (!taskId) { setLoading(false); return; }
    setLoading(true);
    api<Round[]>(`/tasks/${taskId}/rounds`)
      .then((rows) => { setRounds(rows); setLoadError(""); })
      .catch((e: ApiError) => setLoadError(e.code))
      .finally(() => setLoading(false));
  };
  useEffect(loadRounds, [taskId]);

  const editingRound = openRoundId && openRoundId !== "new" ? rounds.find((r) => r.id === openRoundId) ?? null : null;
  const isNew = openRoundId === "new";
  const locked = !!editingRound && editingRound.status === "completed";

  const openExisting = (r: Round) => {
    setOpenRoundId(r.id);
    setDraft({ name: r.name, format: r.format, duration: r.duration, competencies: r.competencies, questions: r.questions, mandatory: r.mandatory, notes: r.notes, interviewerId: r.interviewer?.id ?? "", status: r.status });
  };
  const openNew = () => { setOpenRoundId("new"); setDraft(emptyDraft()); };
  const closeDrawer = () => { setOpenRoundId(null); setDraft(null); };
  const updateDraft = (patch: Partial<RoundDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const saveRound = async () => {
    if (!draft || !taskId) return;
    if (!draft.name.trim()) { say(t.roundNameOwnerRequired); return; }
    setSaving(true);
    try {
      if (isNew) {
        await api(`/tasks/${taskId}/rounds`, { method: "POST", body: JSON.stringify({
          name: draft.name.trim(), format: draft.format, duration: draft.duration, competencies: draft.competencies,
          questions: draft.questions, mandatory: draft.mandatory, notes: draft.notes, interviewerId: draft.interviewerId || null,
        }) });
        say(t.roundCreatedNotice);
      } else if (editingRound) {
        await api(`/rounds/${editingRound.id}`, { method: "PATCH", body: JSON.stringify({
          version: editingRound.version, name: draft.name.trim(), format: draft.format, duration: draft.duration,
          competencies: draft.competencies, questions: draft.questions, mandatory: draft.mandatory, notes: draft.notes,
          status: draft.status, interviewerId: draft.interviewerId || null,
        }) });
        say(t.roundUpdatedNotice);
      }
      closeDrawer();
      set({ planApproved: false });
      loadRounds();
    } catch (e) {
      const code = (e as ApiError).code;
      say(code === "VERSION_CONFLICT"
        ? (zh ? "该轮次已被其他人更新，请重新打开后再修改。" : "This round was updated elsewhere — reopen it and try again.")
        : errorText(code, state.lang));
    } finally {
      setSaving(false);
    }
  };

  const approvePlan = () => {
    if (!state.rubricConfirmed) {
      say(zh ? "请先确认评分标准，再批准面试计划。" : "Confirm the rubric before approving the plan.");
      return;
    }
    if (state.planApproved) {
      say(zh ? "该面试计划已经确定。" : "This plan is already confirmed.");
      return;
    }
    set({ planApproved: true });
    say(zh ? "面试计划已确定，现在可以进行排期。" : "Interview plan confirmed. Scheduling is now available.");
  };

  const footNote = state.followUpRounds.length
    ? (zh ? "补充面试轮次已从评审环节创建，用于补齐安全与合规能力的证据缺口——请先完成排期和面试，再回到决定页。" : "A follow-up round was added from the debrief to close the Security & Compliance evidence gap — schedule and complete it before returning to the decision.")
    : rounds.length > 0 && rounds.every((r) => r.status === "completed")
      ? (zh ? "全部轮次均已完成；该已确认计划现为只读记录。" : "All rounds are complete; this confirmed plan is now a read-only record.")
      : state.planApproved
        ? (zh ? "面试计划已确定。候选人和面试官就绪后，为每一轮安排排期。" : "Plan confirmed. Schedule each planned round when the candidate and interviewers are ready.")
        : (zh ? "请检查负责人、能力覆盖和必问问题，然后确定面试计划再进行排期。" : "Review owners, coverage and mandatory questions, then confirm this plan before scheduling.");

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[15px] font-bold">{t.planRoundsTitle}</div>
          <div className="mt-[3px] text-xs text-[var(--ink-3)]">{t.planRoundsHint}</div>
        </div>
        <button
          onClick={openNew}
          className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-[var(--brand)] bg-[var(--brand)] px-[13px] text-[12.5px] font-semibold text-[var(--brand-ink)]"
        >
          <PlusSvg size={17} />
          {t.newInterviewRound}
        </button>
      </div>

      {loading && <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[17px] py-[15px] text-xs text-[var(--ink-3)]">{zh ? "加载中…" : "Loading…"}</div>}
      {!loading && loadError && (
        <div role="alert" className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[17px] py-[15px] text-xs text-[var(--ink-3)]">
          {errorText(loadError, state.lang)}{" "}
          <button onClick={loadRounds} className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--brand)] underline">{zh ? "重试" : "Retry"}</button>
        </div>
      )}

      {!loading && !loadError && rounds.map((r) => {
        const tags = r.competencies.split(",").map((s) => s.trim()).filter(Boolean);
        const ownerLabel = r.interviewer ? r.interviewer.name : (zh ? "待指定" : "Unassigned");
        const meta = `${r.format} · ${r.duration} ${zh ? "分钟" : "min"} · ${zh ? "负责人：" : "Owner: "}${ownerLabel}`;
        const qLabel = zh ? `${r.questions} 道问题（${r.mandatory} 道必问）` : `${r.questions} questions (${r.mandatory} mandatory)`;
        const statusLabel = r.status === "completed" ? (zh ? "已完成" : "completed") : (zh ? "已规划" : "Planned");
        return (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => openExisting(r)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openExisting(r); } }}
            className="cursor-pointer rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[17px] py-[15px] transition-colors hover:border-[var(--brand)]"
          >
            <div className="flex items-center gap-[9px]">
              <div className="flex-1 text-sm font-semibold">{r.name}</div>
              <Pill label={statusLabel} tone={r.status === "completed" ? "ok" : "warn"} />
              <span className="inline-flex -rotate-90 text-[var(--ink-3)]">
                <ChevronSvg size={18} />
              </span>
            </div>
            <div className="mt-[3px] text-xs text-[var(--ink-3)]">{meta}</div>
            {tags.length > 0 && (
              <div className="mt-[9px] flex flex-wrap gap-[7px]">
                {tags.map((tag) => (
                  <div key={tag} className="rounded-lg border border-[var(--line)] px-2.5 py-[5px] text-xs text-[var(--ink-2)]">
                    {tag}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-[9px] text-xs text-[var(--ink-3)]">
              {qLabel} —{" "}
              <button
                onClick={(e) => { e.stopPropagation(); set({ screen: "brief" }); }}
                className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--brand)] underline"
              >
                {t.viewInBrief}
              </button>
            </div>
          </div>
        );
      })}

      {state.followUpRounds.map((r) => (
        <div key={r.id} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-[17px] py-[15px]">
          <div className="flex items-center gap-[9px]">
            <div className="flex-1 text-sm font-semibold">{r.name}</div>
            <Pill label={r.status} tone={r.status === "completed" ? "ok" : "warn"} />
          </div>
          <div className="mt-[3px] text-xs text-[var(--ink-3)]">{r.meta}</div>
          <div className="mt-[9px] flex flex-wrap gap-[7px]">
            {r.tags.map((tag) => (
              <div key={tag} className="rounded-lg border border-[var(--line)] px-2.5 py-[5px] text-xs text-[var(--ink-2)]">
                {tag}
              </div>
            ))}
          </div>
          <div className="mt-[9px] text-xs text-[var(--ink-3)]">
            {r.qLabel} —{" "}
            <button
              onClick={() => set({ screen: "brief" })}
              className="cursor-pointer border-0 bg-transparent p-0 text-xs text-[var(--brand)] underline"
            >
              {t.viewInBrief}
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-[13px]">
        <div className="max-w-[430px] text-[11.5px] leading-[1.4] text-[var(--ink-3)]">{footNote}</div>
        <div className="flex-1" />
        <button
          onClick={approvePlan}
          className="h-[34px] cursor-pointer rounded-[11px] border border-[var(--line-strong)] bg-[var(--surface)] px-3.5 text-[12.5px] font-semibold text-[var(--ink)]"
        >
          {state.planApproved ? t.interviewPlanConfirmed : t.confirmInterviewPlan}
        </button>
        <button
          onClick={() => set({ screen: "schedule" })}
          className="h-[34px] cursor-pointer rounded-[11px] border border-[var(--brand)] bg-[var(--brand)] px-[15px] text-[12.5px] font-semibold text-[var(--brand-ink)]"
        >
          {t.continueToSchedule}
        </button>
      </div>

      <Drawer
        open={!!openRoundId}
        onClose={closeDrawer}
        placement="right"
        width={600}
        closable={false}
        styles={{ body: { padding: 0 }, wrapper: { width: "min(600px, 96vw)" }, footer: { padding: 0 } }}
        footer={
          draft && (
            <div className="flex justify-end gap-2.5 px-5 py-3.5">
              <button onClick={closeDrawer} className="h-9 cursor-pointer rounded-[9px] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] text-[var(--ink-2)]">
                {t.cancel}
              </button>
              {!locked && (
                <button disabled={saving} onClick={saveRound} className="h-9 cursor-pointer rounded-[9px] border border-[var(--brand)] bg-[var(--brand)] px-[15px] text-[12.5px] font-semibold text-[var(--brand-ink)] disabled:cursor-not-allowed disabled:opacity-60">
                  {isNew ? t.createRound : t.saveRoundChanges}
                </button>
              )}
            </div>
          )
        }
      >
        {draft && (
          <>
            <div className="sticky top-0 z-[2] flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5 pb-[15px] pt-[17px]">
              <div className="flex-1">
                <div className="font-mono text-[10.5px] tracking-[0.05em] text-[var(--ink-3)]">{t.planRoundDrawerEyebrow}</div>
                <div className="mt-1.5 text-lg font-bold">{isNew ? t.newInterviewRound : t.editInterviewRound}</div>
                <div className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t.planRoundDrawerHint}</div>
              </div>
              <button
                aria-label={t.close}
                onClick={closeDrawer}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"
              >
                <CloseSvg />
              </button>
            </div>
            <div className="px-5 pb-6 pt-5">
              {locked && (
                <div className="mb-4 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs text-[var(--ink-2)]">
                  {t.roundLockedNote}
                </div>
              )}
              <div className="flex flex-col gap-4">
                <label className="block">
                  <div className={fieldLabel}>{t.roundNameLabel}</div>
                  <input value={draft.name} disabled={locked} onChange={(e) => updateDraft({ name: e.target.value })} className={fieldInput} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className={fieldLabel}>{t.roundFormatLabel}</div>
                    <select value={draft.format} disabled={locked} onChange={(e) => updateDraft({ format: e.target.value })} className={fieldInput}>
                      {FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <div className={fieldLabel}>{t.roundDurationLabel}</div>
                    <select value={draft.duration} disabled={locked} onChange={(e) => updateDraft({ duration: Number(e.target.value) })} className={fieldInput}>
                      {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <div className={fieldLabel}>{t.roundOwnerLabel}</div>
                  <select value={draft.interviewerId} disabled={locked} onChange={(e) => updateDraft({ interviewerId: e.target.value })} className={fieldInput}>
                    <option value="">{zh ? "待指定" : "Unassigned"}</option>
                    {interviewers.map((o) => <option key={o.id} value={o.id}>{o.title ? `${o.name} · ${o.title}` : o.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <div className={fieldLabel}>{t.roundCompetenciesLabel}</div>
                  <textarea value={draft.competencies} disabled={locked} onChange={(e) => updateDraft({ competencies: e.target.value })} className={`h-[86px] ${fieldTextarea}`} />
                  <div className="mt-[5px] text-[11px] text-[var(--ink-3)]">{t.roundCompetenciesHint}</div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className={fieldLabel}>{t.roundQuestionsLabel}</div>
                    <input type="number" min={1} max={20} value={draft.questions} disabled={locked} onChange={(e) => updateDraft({ questions: Number(e.target.value) })} className={fieldInput} />
                  </label>
                  <label className="block">
                    <div className={fieldLabel}>{t.roundMandatoryLabel}</div>
                    <input type="number" min={0} max={20} value={draft.mandatory} disabled={locked} onChange={(e) => updateDraft({ mandatory: Number(e.target.value) })} className={fieldInput} />
                  </label>
                </div>
                <label className="block">
                  <div className={fieldLabel}>{t.roundNotesLabel}</div>
                  <textarea value={draft.notes} disabled={locked} placeholder={t.roundNotesPlaceholder} onChange={(e) => updateDraft({ notes: e.target.value })} className={`h-24 ${fieldTextarea}`} />
                </label>
                {!isNew && (
                  <label className="block">
                    <div className={fieldLabel}>{zh ? "轮次状态" : "Round status"}</div>
                    <select value={draft.status} disabled={locked} onChange={(e) => updateDraft({ status: e.target.value as RoundDraft["status"] })} className={fieldInput}>
                      <option value="Planned">{zh ? "已规划" : "Planned"}</option>
                      <option value="completed">{zh ? "已完成（完成后锁定，不可再编辑）" : "Completed (locks the round once saved)"}</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
