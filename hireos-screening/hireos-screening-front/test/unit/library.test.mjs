// #174 #176 -- library labels: every source reads as a channel name (never a stored enum), unknown or missing
// sources read neutrally, every match status has its own label, and all of them have Chinese text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceLabel } from "../../src/features/imports/sources.ts";
import { MATCH_STATUS_BADGE } from "../../src/features/library/matchStatus.ts";
import { ZH } from "../../src/data/i18n.ts";

test("#176 AC-1: known sources read as channel names, in English and Chinese", () => {
  assert.equal(sourceLabel("manual_upload"), "Manual upload");
  assert.equal(sourceLabel("paste"), "Paste");
  assert.equal(sourceLabel("email"), "Email");
  for (const value of ["manual_upload", "paste", "email", "folder", "structured_entry"]) {
    const label = sourceLabel(value);
    assert.doesNotMatch(label, /_/, value);
    assert.ok(ZH[label], `${label} has Chinese`);
  }
});

test("#176 AC-2: an unknown source isn't guessed and a missing one says so", () => {
  assert.equal(sourceLabel("partner_feed_v2"), "Other source");
  assert.equal(sourceLabel(""), "Source unknown");
  assert.equal(sourceLabel(null), "Source unknown");
  assert.ok(ZH["Other source"] && ZH["Source unknown"]);
});

test("#174: every match status has its own label, distinct from the linked-role count, with Chinese", () => {
  const labels = Object.values(MATCH_STATUS_BADGE).map((b) => b.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const label of labels) {
    assert.doesNotMatch(label, /linked/i);
    assert.ok(ZH[label], label);
  }
});
