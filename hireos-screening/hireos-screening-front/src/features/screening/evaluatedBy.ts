/**
 * How a screening snapshot says what scored it (#195): the AI with the model it recorded, or the local rules
 * (no AI). Snapshots scored before models were recorded (before #19) were marked "ai" from their evaluator
 * but have no model; no run record holds one, so they say the source can't be traced — nothing is guessed.
 */
export type EvaluatedByInput = { evaluationMode?: string | null; modelVersion?: string | null };

export function evaluatedBy(evaluation: EvaluatedByInput): { tone: "info" | "warning" | "outline"; label: string; model?: string } {
  if (evaluation.evaluationMode === "ai") {
    return evaluation.modelVersion
      ? { tone: "info", label: "AI", model: evaluation.modelVersion }
      : { tone: "outline", label: "AI · source not traceable (scored before models were recorded)" };
  }
  if (evaluation.evaluationMode === "rules") return { tone: "warning", label: "Rule-based (no AI)" };
  return { tone: "outline", label: "Not recorded" };
}
