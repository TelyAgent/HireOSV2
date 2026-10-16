// #195 AC-2/AC-3 -- a snapshot says what scored it: the AI with its real model, the rules (no AI), or — for
// AI snapshots from before models were recorded — that the source can't be traced. Never a guessed model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluatedBy } from "../../src/features/screening/evaluatedBy.ts";
import { ZH } from "../../src/data/i18n.ts";

test("#195 AC-2: an AI snapshot shows its recorded model; a rules snapshot says no AI was used", () => {
  assert.deepEqual(evaluatedBy({ evaluationMode: "ai", modelVersion: "gpt-5.6-luna" }), { tone: "info", label: "AI", model: "gpt-5.6-luna" });
  assert.equal(evaluatedBy({ evaluationMode: "rules", modelVersion: null }).label, "Rule-based (no AI)");
});

test("#195 AC-3: an AI snapshot without a model says its source can't be traced, without inventing one", () => {
  const by = evaluatedBy({ evaluationMode: "ai", modelVersion: null });
  assert.equal(by.model, undefined);
  assert.match(by.label, /not traceable/);
  assert.match(ZH[by.label], /不可追溯/);
});
