import { useState } from "react";
import { useStore } from "../store/StoreContext";
import type { Criterion, Evaluation } from "../data/fixtures";
import { evidenceState } from "../utils/evidence";

/**
 * Why a criterion scored as it did (#378): the AI's rationale and the answer excerpts behind it, each placed by
 * question and lines and openable in the answer with those lines highlighted. When there is nothing to show it
 * says why -- scoring still running or failed, scored by hand, or an evaluation from before excerpts were kept.
 */
export function CriterionEvidence({ c, answers, aiStatus, aiError }: {
  c: Criterion;
  answers: { questionId: string; title: string; answerText: string }[];
  aiStatus?: Evaluation["aiStatus"];
  aiError?: string | null;
}) {
  const { t } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const state = evidenceState(c, aiStatus);
  const note: Record<typeof state, string | null> = {
    ok: null,
    running: t("The AI evaluation is still running — its rationale and excerpts appear here when it finishes."),
    failed: `${t("The AI evaluation failed, so there is no AI evidence for this criterion.")}${aiError ? ` (${aiError})` : ""}`,
    manual: t("Scored by hand without an AI evaluation — there is no AI evidence for this criterion."),
    none: t("The AI gave no rationale or excerpt for this criterion."),
  };
  return (
    <div className="evidence-excerpt" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
      {note[state] && <div className="tiny" role="note">{note[state]}</div>}
      {c.evidence && (
        <div>
          <div className="tiny" style={{ fontWeight: 600 }}>{t("Rationale")}</div>
          <div>{c.evidence}</div>
        </div>
      )}
      {c.quotes && c.quotes.length > 0 && (
        <div>
          <div className="tiny" style={{ fontWeight: 600 }}>{t("Excerpts from the answer")}</div>
          {c.quotes.map((q, i) => {
            const index = answers.findIndex((a) => a.questionId === q.questionId);
            const answer = answers[index];
            const lines = q.lineFrom === q.lineTo ? t("line %s").replace("%s", String(q.lineFrom)) : t("lines %s–%e").replace("%s", String(q.lineFrom)).replace("%e", String(q.lineTo));
            const where = `${t("Question")} ${index + 1} · ${lines}`;
            return (
              <div key={i} style={{ marginTop: 6 }}>
                <blockquote style={{ margin: 0, paddingLeft: 10, borderLeft: "3px solid var(--accent-300)" }}>“{q.text}”</blockquote>
                <div className="tiny" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{where}</span>
                  {answer ? (
                    <button type="button" className="btn ghost sm" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                      {open === i ? t("Hide answer") : t("Show in answer")}
                    </button>
                  ) : (
                    <span className="muted">{t("The answer isn't loaded here.")}</span>
                  )}
                </div>
                {open === i && answer && <AnswerLines text={answer.answerText} from={q.lineFrom} to={q.lineTo} title={answer.title} />}
              </div>
            );
          })}
        </div>
      )}
      {c.quotes === undefined && c.evidence && state === "ok" && (
        <div className="tiny muted">{t("Excerpts weren't recorded for evaluations made before 17 Oct 2026 — only the rationale is available.")}</div>
      )}
      {!!c.unlocatedQuotes && (
        <div className="tiny muted">{t("%s excerpt(s) the AI gave are not in the answer and are not shown.").replace("%s", String(c.unlocatedQuotes))}</div>
      )}
      <div className="tiny">{t("Source:")} {t(c.source)}</div>
    </div>
  );
}

/** The answer with the quoted lines highlighted, two lines of context around them. */
function AnswerLines({ text, from, to, title }: { text: string; from: number; to: number; title: string }) {
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, from - 2);
  const end = Math.min(lines.length, to + 2);
  return (
    <div className="card card-pad tiny" style={{ marginTop: 6, background: "var(--canvas)" }}>
      <div className="muted" style={{ marginBottom: 4 }}>{title}</div>
      <ol start={start} style={{ margin: 0, paddingLeft: 36, listStyle: "decimal", fontFamily: "inherit", lineHeight: 1.7 }}>
        {lines.slice(start - 1, end).map((line, i) => {
          const n = start + i;
          const hit = n >= from && n <= to;
          return <li key={n} style={hit ? { background: "var(--accent-50)", fontWeight: 600 } : undefined}>{line || " "}</li>;
        })}
      </ol>
    </div>
  );
}
