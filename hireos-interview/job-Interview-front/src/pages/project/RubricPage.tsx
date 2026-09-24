import { useEffect, useState } from "react";
import { Drawer } from "antd";
import { useStore } from "../../store/StoreContext";
import { Pill, type Tone } from "../../utils/status";
import { PlusSvg, CloseSvg, SpinnerSvg } from "../../components/ui/Icons";
import { useTask } from "../../features/project-intake/useTask";
import { useRubric } from "../../features/project-intake/useRubric";
import type { CapabilityCard, CardInput, CardPriority, ResponsibilityType } from "../../features/project-intake/api";
import { errorText } from "../../features/project-intake/i18n";

const PRIORITY_TONE: Record<CardPriority, Tone> = { P0: "bad", P1: "warn", P2: "unknown" };
const RESPONSIBILITY_OPTIONS: ResponsibilityType[] = ["lead", "collaborate", "support"];
const PRIORITY_OPTIONS: CardPriority[] = ["P0", "P1", "P2"];

type CardDraft = {
  id?: string; requirement: string; responsibilityType: ResponsibilityType; cardPriority: CardPriority;
  competencyTags: string; expectedEvidence: string; weight: number;
  l1: string; l2: string; l3: string; l4: string; l5: string;
};

const emptyDraft = (): CardDraft => ({
  requirement: "", responsibilityType: "lead", cardPriority: "P1", competencyTags: "",
  expectedEvidence: "", weight: 10, l1: "", l2: "", l3: "", l4: "", l5: "",
});
const draftFromCard = (c: CapabilityCard): CardDraft => ({
  id: c.id, requirement: c.requirement, responsibilityType: c.responsibilityType, cardPriority: c.cardPriority,
  competencyTags: c.competencyTags, expectedEvidence: c.expectedEvidence, weight: c.weight,
  l1: c.levelAnchors.l1, l2: c.levelAnchors.l2, l3: c.levelAnchors.l3, l4: c.levelAnchors.l4, l5: c.levelAnchors.l5,
});
const draftToInput = (d: CardDraft): CardInput => ({
  id: d.id, requirement: d.requirement.trim(), responsibilityType: d.responsibilityType, cardPriority: d.cardPriority,
  competencyTags: d.competencyTags.split(",").map((s) => s.trim()).filter(Boolean),
  expectedEvidence: d.expectedEvidence.trim(), weight: d.weight,
  levelAnchors: { l1: d.l1.trim(), l2: d.l2.trim(), l3: d.l3.trim(), l4: d.l4.trim(), l5: d.l5.trim() },
});

const fieldLabel = "mb-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]";
const fieldInput = "h-10 w-full rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60";
const fieldTextarea = "w-full resize-y rounded-[9px] border border-[var(--line-strong)] bg-[var(--surface)] px-[11px] py-2.5 text-[12.5px] leading-[1.5] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60";

export function RubricPage() {
  const { state, set, say, t } = useStore();
  const zh = state.lang === "zh";
  const { task } = useTask(state.currentTaskId);
  const jobId = task?.job.id ?? null;
  const { state: rubricState, loading, error, generate, updateCards, confirm, newVersion, reload } = useRubric(jobId);

  const rubric = rubricState?.rubric ?? null;
  const generation = rubricState?.generation ?? null;
  const isDraft = rubric?.status === "draft";
  const isConfirmed = rubric?.status === "confirmed";
  const isGenerating = generation?.status === "queued" || generation?.status === "parsing";

  // Plan/Schedule/Brief still gate on these global mock flags (see the implementation
  // plan's scope boundary); keep them in sync with this job's real rubric so those
  // still-mock pages behave correctly per task instead of leaking the previous task's state.
  useEffect(() => {
    if (!jobId) return;
    set({ rubricExtracted: !!rubric, rubricConfirmed: isConfirmed, rubricVersion: rubric?.versionNumber ?? 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, rubric?.id, rubric?.status]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openCardId, setOpenCardId] = useState<string | null>(null); // "new" while creating
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const openExisting = (c: CapabilityCard) => { setOpenCardId(c.id); setDraft(draftFromCard(c)); };
  const openNew = () => { setOpenCardId("new"); setDraft(emptyDraft()); };
  const closeDrawer = () => { setOpenCardId(null); setDraft(null); };
  const updateDraft = (patch: Partial<CardDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const saveCard = async () => {
    if (!draft || !rubric) return;
    if (!draft.requirement.trim()) { say(zh ? "请填写 JD 要求。" : "Enter the JD requirement."); return; }
    const others = rubric.cards.filter((c) => c.id !== draft.id).map((c) => draftToInput(draftFromCard(c)));
    setSaving(true);
    try {
      await updateCards(rubric.version, [...others, draftToInput(draft)]);
      closeDrawer();
    } catch (e) {
      say(errorText((e as { code?: string }).code || "REQUEST_FAILED", state.lang));
    } finally {
      setSaving(false);
    }
  };

  const deleteCard = async () => {
    if (!draft?.id || !rubric) return;
    setSaving(true);
    try {
      const remaining = rubric.cards.filter((c) => c.id !== draft.id).map((c) => draftToInput(draftFromCard(c)));
      await updateCards(rubric.version, remaining);
      closeDrawer();
    } catch (e) {
      say(errorText((e as { code?: string }).code || "REQUEST_FAILED", state.lang));
    } finally {
      setSaving(false);
    }
  };

  const onGenerate = async () => {
    try { await generate(); } catch (e) { say(errorText((e as { code?: string }).code || "REQUEST_FAILED", state.lang)); }
  };
  const onConfirm = async () => {
    if (!rubric) return;
    try {
      await confirm(rubric.version);
      say(zh ? `评分标准 v${rubric.versionNumber} 已确认，现在可以规划面试。` : `Rubric v${rubric.versionNumber} confirmed. Interview planning is now available.`);
    } catch (e) { say(errorText((e as { code?: string }).code || "REQUEST_FAILED", state.lang)); }
  };
  const onNewVersion = async () => {
    try {
      await newVersion();
      say(zh ? "已创建新草稿版本。" : "Created a new draft version.");
    } catch (e) { say(errorText((e as { code?: string }).code || "REQUEST_FAILED", state.lang)); }
  };

  const weightTotal = rubric ? rubric.cards.reduce((sum, c) => sum + c.weight, 0) : 0;
  const locked = isConfirmed;

  return (
    <>
      <div
        className={
          "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] " +
          (isConfirmed
            ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[var(--ink)]"
            : "border-[var(--line-strong)] bg-[var(--surface-2)] text-[var(--ink-2)]")
        }
      >
        {isGenerating && <SpinnerSvg />}
        <span>
          {!jobId
            ? (zh ? "未找到关联的岗位。" : "No linked job found.")
            : !rubric && !isGenerating
              ? t.rubricEmptyHint
              : isGenerating
                ? t.rubricGenerating
                : isConfirmed
                  ? `✓ ${t.rubricVersionLabel}${rubric!.versionNumber}${t.rubricConfirmedBy}${t.rubricConfirmedSuffix}`
                  : `${t.rubricVersionLabel}${rubric!.versionNumber}${t.rubricDraftAwaiting}`}
        </span>
      </div>

      {generation?.status === "failed" && (
        <div className="rounded-xl border border-[var(--bad)] bg-[var(--bad-soft)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink)]">
          {errorText(generation.errorCode || "REQUEST_FAILED", state.lang)}{" "}
          <button onClick={onGenerate} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-[var(--brand)] underline">
            {zh ? "重试" : "Retry"}
          </button>
        </div>
      )}
      {!!error && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink-3)]">
          {errorText(error, state.lang)}{" "}
          <button onClick={reload} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-[var(--brand)] underline">
            {zh ? "重试" : "Retry"}
          </button>
        </div>
      )}

      {!loading && !rubric && !isGenerating && jobId && (
        <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-6 text-center">
          <div className="text-[13px] text-[var(--ink-2)]">{t.rubricEmptyTitle}</div>
          <button
            onClick={onGenerate}
            className="mt-3 h-[34px] cursor-pointer rounded-[10px] border border-[var(--brand)] bg-[var(--brand)] px-[15px] text-[12.5px] font-semibold text-[var(--brand-ink)]"
          >
            {t.rubricGenerateCta}
          </button>
        </div>
      )}

      {rubric && (
        <>
          <div className="flex items-center gap-[9px]">
            <div className="flex-1 font-mono text-[10.5px] tracking-[0.05em] text-[var(--ink-3)]">{t.rubricCardsHeader} ({rubric.cards.length})</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">{zh ? `权重合计 ${weightTotal}%` : `Weights total ${weightTotal}%`}</div>
          </div>

          {rubric.cards.map((c) => {
            const tags = c.competencyTags.split(",").map((s) => s.trim()).filter(Boolean);
            const isOpen = !!expanded[c.id];
            return (
              <div
                key={c.id}
                className="rounded-[14px] border bg-[var(--surface)] px-[17px] py-[15px]"
                style={{ borderColor: c.cardPriority === "P0" ? "var(--bad)" : "var(--line)" }}
              >
                <div className="flex items-start gap-[10px]">
                  <Pill label={t[`cardPriority${c.cardPriority}` as "cardPriorityP0"]} tone={PRIORITY_TONE[c.cardPriority]} />
                  <Pill label={t[`responsibility${c.responsibilityType.charAt(0).toUpperCase()}${c.responsibilityType.slice(1)}` as "responsibilityLead"]} tone="unknown" />
                  <div className="flex-1 text-[14.5px] font-semibold">{c.requirement}</div>
                  <div className="flex-none rounded-md bg-[var(--surface-3)] px-2.5 py-1 text-[11px] text-[var(--ink-2)]">
                    {t.cardWeightLabel} {c.weight}%
                  </div>
                </div>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-[7px]">
                    {tags.map((tag) => (
                      <div key={tag} className="rounded-lg border border-[var(--line)] px-2.5 py-[5px] text-xs text-[var(--ink-2)]">{tag}</div>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-[12.5px] leading-[1.55] text-[var(--ink-2)]">
                  <span className="text-[var(--ink-3)]">{t.expectedEvidenceLabel}: </span>{c.expectedEvidence}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => setExpanded((m) => ({ ...m, [c.id]: !m[c.id] }))}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-[var(--brand)] underline"
                  >
                    {t.viewAnchors}
                  </button>
                  {!locked && (
                    <button onClick={() => openExisting(c)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] text-[var(--ink-2)] underline">
                      {zh ? "编辑" : "Edit"}
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="mt-2.5 flex flex-col gap-1.5 rounded-[10px] bg-[var(--surface-2)] p-3">
                    {(["l1", "l2", "l3", "l4", "l5"] as const).map((lvl, i) => (
                      <div key={lvl} className="text-[12px] leading-[1.5] text-[var(--ink-2)]">
                        <span className="font-semibold text-[var(--ink-3)]">L{i + 1} — </span>{c.levelAnchors[lvl]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!locked && (
            <button
              onClick={openNew}
              className="flex h-[38px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[var(--line-strong)] bg-transparent text-[12.5px] text-[var(--ink-2)]"
            >
              <PlusSvg size={16} />
              {t.rubricAddCard}
            </button>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-[13px]">
        <div className="max-w-[430px] text-[11.5px] leading-[1.4] text-[var(--ink-3)]">
          {isConfirmed
            ? (zh ? `已确认的评分标准 v${rubric!.versionNumber} 将作为该岗位后续所有评分的依据。` : `Confirmed rubric v${rubric!.versionNumber} is the version behind every future score in this project.`)
            : (zh ? "AI 从 JD 生成草稿，需人工确认后才能用于评分。" : "AI drafted this from the JD. No score can be recorded until a human confirms it.")}
        </div>
        <div className="flex-1" />
        {rubric && !isGenerating && (
          <button
            onClick={onGenerate}
            className="h-[34px] cursor-pointer rounded-[11px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] text-[var(--ink-2)]"
          >
            {t.rubricRegenerate}
          </button>
        )}
        {isDraft && (
          <button onClick={onConfirm} className="h-[34px] cursor-pointer rounded-[11px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink)]">
            {t.rubricConfirmCta}
          </button>
        )}
        {isConfirmed && (
          <button onClick={onNewVersion} className="h-[34px] cursor-pointer rounded-[11px] border border-[var(--line-strong)] bg-[var(--surface)] px-3 text-[12.5px] font-semibold text-[var(--ink)]">
            {t.rubricNewVersionCta}
          </button>
        )}
        <button onClick={() => set({ screen: "overview" })} className="h-[34px] cursor-pointer rounded-[11px] border border-transparent bg-transparent px-3 text-[12.5px] text-[var(--ink-2)]">
          {t.backToOverview}
        </button>
        <button onClick={() => set({ screen: "plan" })} className="h-[34px] cursor-pointer rounded-[11px] border border-[var(--brand)] bg-[var(--brand)] px-[15px] text-[12.5px] font-semibold text-[var(--brand-ink)]">
          {t.continueToPlan}
        </button>
      </div>

      <Drawer
        open={!!openCardId}
        onClose={closeDrawer}
        placement="right"
        width={600}
        closable={false}
        styles={{ body: { padding: 0 }, wrapper: { width: "min(600px, 96vw)" }, footer: { padding: 0 } }}
        footer={
          draft && (
            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5">
              {draft.id && (
                <button onClick={deleteCard} disabled={saving} className="mr-auto h-9 cursor-pointer rounded-[9px] border border-[var(--line)] bg-transparent px-3.5 text-[12.5px] text-[var(--bad)] disabled:cursor-not-allowed disabled:opacity-60">
                  {t.rubricDeleteCard}
                </button>
              )}
              <button onClick={closeDrawer} className="h-9 cursor-pointer rounded-[9px] border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] text-[var(--ink-2)]">
                {t.cancel}
              </button>
              <button disabled={saving} onClick={saveCard} className="h-9 cursor-pointer rounded-[9px] border border-[var(--brand)] bg-[var(--brand)] px-[15px] text-[12.5px] font-semibold text-[var(--brand-ink)] disabled:cursor-not-allowed disabled:opacity-60">
                {t.saveCard}
              </button>
            </div>
          )
        }
      >
        {draft && (
          <>
            <div className="sticky top-0 z-[2] flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5 pb-[15px] pt-[17px]">
              <div className="flex-1">
                <div className="font-mono text-[10.5px] tracking-[0.05em] text-[var(--ink-3)]">{t.rubricCardsHeader}</div>
                <div className="mt-1.5 text-lg font-bold">{openCardId === "new" ? t.newCapabilityCard : t.editCapabilityCard}</div>
              </div>
              <button aria-label={t.close} onClick={closeDrawer} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]">
                <CloseSvg />
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 pb-6 pt-5">
              <label className="block">
                <div className={fieldLabel}>{t.cardRequirementLabel}</div>
                <textarea value={draft.requirement} onChange={(e) => updateDraft({ requirement: e.target.value })} className={`h-[64px] ${fieldTextarea}`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className={fieldLabel}>{t.cardResponsibilityLabel}</div>
                  <select value={draft.responsibilityType} onChange={(e) => updateDraft({ responsibilityType: e.target.value as ResponsibilityType })} className={fieldInput}>
                    {RESPONSIBILITY_OPTIONS.map((r) => (
                      <option key={r} value={r}>{t[`responsibility${r.charAt(0).toUpperCase()}${r.slice(1)}` as "responsibilityLead"]}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className={fieldLabel}>{t.cardPriorityLabel}</div>
                  <select value={draft.cardPriority} onChange={(e) => updateDraft({ cardPriority: e.target.value as CardPriority })} className={fieldInput}>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{t[`cardPriority${p}` as "cardPriorityP0"]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <div className={fieldLabel}>{t.cardTagsLabel}</div>
                <input value={draft.competencyTags} onChange={(e) => updateDraft({ competencyTags: e.target.value })} className={fieldInput} />
                <div className="mt-[5px] text-[11px] text-[var(--ink-3)]">{t.cardTagsHint}</div>
              </label>
              <label className="block">
                <div className={fieldLabel}>{t.expectedEvidenceLabel}</div>
                <textarea value={draft.expectedEvidence} onChange={(e) => updateDraft({ expectedEvidence: e.target.value })} className={`h-20 ${fieldTextarea}`} />
              </label>
              <label className="block">
                <div className={fieldLabel}>{t.cardWeightLabel} (%)</div>
                <input type="number" min={0} max={100} value={draft.weight} onChange={(e) => updateDraft({ weight: Number(e.target.value) })} className={fieldInput} />
              </label>
              <div>
                <div className={fieldLabel}>{t.levelAnchorsLabel}</div>
                <div className="flex flex-col gap-2">
                  {(["l1", "l2", "l3", "l4", "l5"] as const).map((lvl, i) => (
                    <textarea
                      key={lvl}
                      value={draft[lvl]}
                      onChange={(e) => updateDraft({ [lvl]: e.target.value } as Partial<CardDraft>)}
                      placeholder={`L${i + 1}`}
                      className={`h-14 ${fieldTextarea}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
}
