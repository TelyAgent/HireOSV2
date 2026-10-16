// #179 -- the page applies the same rules as the server: protected attributes and vague judgements are refused
// with a translated reason and alternative; specific requirements pass.
import { test } from "node:test";
import assert from "node:assert/strict";
import { requirementProblem } from "../../src/features/jobs/requirementPolicy.ts";
import { ZH } from "../../src/data/i18n.ts";

test("#179 AC-1/AC-2/AC-4: same verdicts as the server rules", () => {
  for (const label of ["限男性 35岁以下", "Male only, under 35", "age under 30"]) assert.equal(requirementProblem(label)?.kind, "protected_attribute", label);
  assert.equal(requirementProblem("Great person")?.kind, "unverifiable");
  for (const label of ["5+ years of backend experience", "Experience with single sign-on (SSO)", "有女性用户产品经验"]) assert.equal(requirementProblem(label), null, label);
});

test("#179: every reason, attribute and alternative has Chinese text", () => {
  for (const label of ["限男性 35岁以下", "已婚已育", "本地户口", "Height 170cm+", "Must be Christian", "Great person", "disabled applicants excluded"]) {
    const p = requirementProblem(label);
    assert.ok(p, label);
    assert.ok(ZH[p.suggestion], p.suggestion);
    if (p.attribute) assert.ok(ZH[p.attribute], p.attribute);
  }
  assert.ok(ZH["Protected attributes ({attribute}) can't be used for screening."]);
  assert.ok(ZH["This can't be checked against a résumé."]);
});
