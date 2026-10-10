/**
 * Analysis tab: the completeness check (JD Completeness Standard v0.1) as a to-do list —
 * blockers, missing required items, items to revise, optional-section suggestions and what passed.
 */
import { Icon } from "../../components/ui/Icons";
import { useStore } from "../../store/StoreContext";
import { useDocActions } from "./docActions";
import { useCompleteness } from "./useCompleteness";
import { scrollToBlock } from "./DocumentTab";
import { REQ_GROUP_LABELS, verdictOf, type ReqItem, type ReqRow } from "./completeness";
import { selectDraft } from "./docHelpers";
import type { AiFinding } from "./documentsApi";
import type { ReactNode } from "react";

export function AnalysisPanel({ jobId }: { jobId: string }) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId);
  const ev = useCompleteness(jobId);
  if (!ev) return null;

  const verdict = verdictOf(ev);
  const kind = verdict === "blocked" ? "bad" : verdict === "needs_work" ? "warn" : "ok";
  const bad = ev.rows.filter((r) => !r.ok);
  const weak = ev.rows.filter((r) => r.ok && r.weak);
  const good = ev.rows.filter((r) => r.ok && !r.weak);
  const blockers = ev.flags.filter((f) => f.severity === "blocker");
  const warnings = ev.flags.filter((f) => f.severity === "warning");
  const analyzedAt = state.wsAnalyzedAt[jobId];
  const pct = Math.round((ev.passed / ev.total) * 100);

  const parts = [
    ev.blockers ? `${ev.blockers} ${t("blocking")}` : "",
    ev.missing ? `${ev.missing} ${t("missing")}` : "",
    ev.weakCount ? `${ev.weakCount} ${t("to revise")}` : "",
  ].filter(Boolean);
  const headline = parts.length ? parts.join(" · ") : t("All required items complete");

  const busy = (what: string) => !!state.wsAiBusy[`${jobId}:${what}`];
  const aiLink = (what: string, label: string, busyLabel: string, run: () => void) => (
    <button className="req-link req-link-ai" disabled={busy(what)} onClick={run}>
      {busy(what) ? t(busyLabel) : t(label)}
    </button>
  );
  const aiDraftLink = (item: ReqItem) => (item.heading && !item.noAi ? aiLink(item.id, "AI draft", "Drafting…", () => actions.aiDraft(item)) : null);
  const fixable = ev.rows.filter((r) => r.item.heading && !r.item.noAi && (!r.ok || r.weak)).length;
  const firstBlockId = selectDraft(state, jobId).blocks[0]?.id;
  const ai = state.wsAiAnalysis[jobId];
  const aiStale = !!ai && ai.revision !== selectDraft(state, jobId).revision;

  const fillAction = (r: ReqRow) =>
    r.item.field ? (
      <button className="req-link" onClick={() => actions.focusField(r.item.field!)}>
        {t("Fill in")}
      </button>
    ) : r.item.heading ? (
      <button className="req-link" onClick={() => (r.item.id === "F1" ? actions.openSalaryForm() : actions.fillRequired(r.item))}>
        {t("Fill in")}
      </button>
    ) : null;
  const goTo = (r: ReqRow) =>
    r.item.field ? (
      <button
        className="req-link"
        onClick={() =>
          r.item.field === "title"
            ? firstBlockId && actions.focusBlock(firstBlockId)
            : actions.focusField(r.item.field!)
        }
      >
        {t("Go to")}
      </button>
    ) : (
      <button className="req-link" onClick={() => actions.goToSection(r.section?.head?.id ?? null)}>
        {t("Go to")}
      </button>
    );

  return (
    <div className="ck">
      <div className={`ck-summary ${kind}`}>
        <Icon name={kind === "bad" ? "error" : kind === "warn" ? "warning" : "check_circle"} className="ck-sum-ico" />
        <div>
          <div className="ck-head">{headline}</div>
          <div className="ck-sub">
            {ev.passed} / {ev.total} {t("required items passed")}
            {ev.language && ` · ${t("Language")}: ${ev.language === "zh" ? "中文" : "English"}`}
          </div>
        </div>
      </div>
      <div className={`ck-meter ${kind}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {fixable > 0 && (
        <button
          type="button"
          className="ck-aiall"
          disabled={busy("all")}
          title={t("Copilot works from this job’s data. Review before publishing.")}
          onClick={() => void actions.aiFixAll(ev)}
        >
          <Icon name={busy("all") ? "autorenew" : "auto_awesome"} className={busy("all") ? "req-spin" : undefined} />
          {busy("all") ? t("Working…") : `${t("AI fix all")} (${fixable})`}
        </button>
      )}

      <CheckSection title={t("Blocking")} n={blockers.length}>
        {blockers.map((f) => (
          <CheckRow
            key={f.blockId + f.rule}
            icon="block"
            tone="bad"
            name={`${f.rule} · ${t(f.rule.startsWith("V") ? "Visibility" : "Compliance")}`}
            note={t(f.message)}
          >
            {f.shouldBe && (
              <button className="req-link" onClick={() => actions.fixVisibility(f.blockId, f.shouldBe!)}>
                {t("Mark Confidential")}
              </button>
            )}
            <button className="req-link" onClick={() => scrollToBlock(f.blockId)}>
              {t("Go to")}
            </button>
          </CheckRow>
        ))}
      </CheckSection>

      <CheckSection title={t("To complete")} n={bad.length}>
        {bad.map((r) => (
          <CheckRow key={r.item.id} icon="error" tone="bad" name={t(r.item.label)} note={`${t(REQ_GROUP_LABELS[r.item.group])} · ${t(r.note)}`}>
            {aiDraftLink(r.item)}
            {fillAction(r)}
          </CheckRow>
        ))}
      </CheckSection>

      <CheckSection title={t("To revise")} n={weak.length + warnings.length}>
        {weak.map((r) => (
          <CheckRow key={r.item.id} icon="warning" tone="warn" name={t(r.item.label)} note={t(r.weak)}>
            {r.item.heading && !r.item.noAi && aiLink(r.item.id, "AI fix", "Revising…", () => actions.aiFix(r))}
            {r.item.id === "F1" && (
              <button className="req-link" onClick={() => actions.openSalaryForm()}>
                {t("Fill in by format")}
              </button>
            )}
            {goTo(r)}
          </CheckRow>
        ))}
        {warnings.map((f) => (
          <CheckRow key={f.blockId + f.rule} icon="warning" tone="warn" name={`${f.rule} · ${t(f.rule.startsWith("X") ? "Consistency" : "Wording")}`} note={t(f.message)}>
            <button className="req-link" onClick={() => scrollToBlock(f.blockId)}>
              {t("Go to")}
            </button>
          </CheckRow>
        ))}
      </CheckSection>

      {analyzedAt && (
        <CheckSection title={t("Suggestions")} n={ev.suggestions.length}>
          {ev.suggestions.map((s) => (
            <CheckRow key={s.id} icon="lightbulb" tone="tip" name={t(s.label)} note={t(s.hint)}>
              {aiDraftLink(s)}
              <button className="req-link" onClick={() => actions.fillRequired(s)}>
                {t("Add")}
              </button>
            </CheckRow>
          ))}
        </CheckSection>
      )}

      {(busy("analyze") || ai) && (
        <section className="ck-sec">
          <div className="ck-sec-h">
            <Icon name="auto_awesome" className="ck-ai-ico" />
            {t("AI review")}
            {ai && !busy("analyze") && <span>{ai.result.items.length}</span>}
          </div>
          {busy("analyze") ? (
            <div className="ck-ai-loading">
              <Icon name="autorenew" className="req-spin" />
              {t("Copilot is reviewing this JD against the completeness standard…")}
            </div>
          ) : (
            ai && (
              <>
                {aiStale && (
                  <div className="ck-ai-stale">
                    <Icon name="history" />
                    {t("The document changed after this review.")}
                    <button className="req-link" onClick={() => actions.analyze()}>
                      {t("Re-analyze")}
                    </button>
                  </div>
                )}
                {ai.result.summary && <div className="ck-ai-summary">{ai.result.summary}</div>}
                {ai.result.items.map((f, i) => (
                  <AiFindingRow key={`${f.id}-${i}`} f={f} onApply={() => actions.applyFinding(f)} />
                ))}
                {!ai.result.items.length && <div className="ck-note">{t("No further issues found.")}</div>}
              </>
            )
          )}
        </section>
      )}

      <details className="ck-done" open>
        <summary>
          <Icon name="chevron_right" className="ck-caret" />
          {t("Completed")}
          <span>{good.length}</span>
        </summary>
        <div className="ck-chips">
          {good.map((r) => (
            <span key={r.item.id} className="ck-chip">
              <Icon name="check" />
              {t(r.item.label)}
            </span>
          ))}
        </div>
      </details>

      <div className="ck-foot">
        <Icon name="auto_awesome" />
        {analyzedAt
          ? `${t("Analyzed at")} ${new Date(analyzedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : t("Click Analyze for improvement suggestions.")}
      </div>
    </div>
  );
}

function AiFindingRow({ f, onApply }: { f: AiFinding; onApply: () => void }) {
  const { t } = useStore();
  const tone = f.severity === "blocker" ? "bad" : f.severity === "warning" ? "warn" : "tip";
  const icon = f.severity === "blocker" ? "block" : f.severity === "warning" ? "warning" : "lightbulb";
  const severity = { blocker: "Blocking", warning: "To revise", suggestion: "Suggestion" }[f.severity];
  return (
    <CheckRow
      icon={icon}
      tone={tone}
      name={`${f.id} · ${t(severity)}`}
      note={f.reason}
      extra={
        <>
          {f.evidence && <div className="ck-ai-evidence">“{f.evidence}”</div>}
          {f.suggestion && <div className="ck-ai-suggestion">{f.suggestion}</div>}
        </>
      }
    >
      {f.blockId && f.suggestion && (
        <button className="req-link req-link-ai" onClick={onApply}>
          {t("Apply")}
        </button>
      )}
      {f.blockId && (
        <button className="req-link" onClick={() => scrollToBlock(f.blockId!)}>
          {t("Go to")}
        </button>
      )}
    </CheckRow>
  );
}

function CheckSection({ title, n, children }: { title: string; n: number; children: ReactNode }) {
  if (!n) return null;
  return (
    <section className="ck-sec">
      <div className="ck-sec-h">
        {title}
        <span>{n}</span>
      </div>
      {children}
    </section>
  );
}

function CheckRow({
  icon,
  tone,
  name,
  note,
  extra,
  children,
}: {
  icon: string;
  tone: "bad" | "warn" | "tip";
  name: string;
  note: string;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="ck-row">
      <Icon name={icon} className={`ck-ico ${tone}`} />
      <div className="ck-main">
        <div className="ck-top">
          <span className="ck-name">{name}</span>
          <span className="ck-acts">{children}</span>
        </div>
        <div className="ck-note">{note}</div>
        {extra}
      </div>
    </div>
  );
}
