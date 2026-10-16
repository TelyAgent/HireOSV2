// #162 #163 #165 #166 -- every failed or isolated file says, in its own words, why and what to do; never a raw
// error code or "Bad Request Exception"; every one has its Chinese text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeItem, FILE_ERROR } from "../../src/features/imports/importOutcome.ts";
import { ZH } from "../../src/data/i18n.ts";

const failed = (errorCode, extra = {}) => ({ id: "i", fileName: "f", sizeKB: 1, status: "failed", outcome: errorCode, errorCode, retryable: false, ...extra });

test("#162: an over-long PDF says it has more than 10 pages", () => {
  const d = describeItem(failed("PDF_TOO_MANY_PAGES", { outcome: "parse_failed" }));
  assert.equal(d.label, "More than 10 pages");
  assert.ok(d.reselect);
});

test("#163: a password-protected PDF shows as quarantined for its encryption, not as an unreadable scan", () => {
  const d = describeItem({ ...failed("PDF_ENCRYPTED"), outcome: "quarantined" });
  assert.match(d.label, /Quarantined/);
  assert.match(d.detail, /password-protected/);
  assert.doesNotMatch(d.detail, /scan/i);
  // Other quarantines no longer claim a password.
  assert.doesNotMatch(describeItem({ ...failed("PDF_ACTIVE_CONTENT_DETECTED"), outcome: "quarantined" }).detail, /password/);
});

test("#165: a damaged PDF and a scan without text are told apart, each with a way forward", () => {
  const damaged = describeItem(failed("FILE_UNREADABLE", { outcome: "parse_failed" }));
  const scan = describeItem(failed("OCR_REQUIRED", { outcome: "parse_failed" }));
  assert.equal(damaged.label, "File damaged");
  assert.doesNotMatch(damaged.detail, /scan/i);
  assert.equal(scan.label, "Scan without readable text");
  assert.ok(damaged.reselect && scan.reselect);
});

test("#166: an empty file and an unsupported type read as such, never as an internal error", () => {
  const empty = describeItem(failed("EMPTY_FILE", { errorMessage: "Bad Request Exception" }));
  assert.equal(empty.detail, "The file is empty. Choose a file with content.");
  const png = describeItem(failed("UNSUPPORTED_FILE_TYPE", { errorMessage: "Bad Request Exception" }));
  assert.match(png.detail, /PDF, DOCX and TXT/);
  const unknown = describeItem(failed("SOMETHING_NEW", { errorMessage: "Bad Request Exception" }));
  for (const d of [empty, png, unknown]) {
    assert.doesNotMatch(`${d.label} ${d.detail}`, /Bad Request Exception|[A-Z]{3,}_[A-Z_]+/);
  }
});

test("every file-error text has its Chinese translation", () => {
  for (const { label, detail } of Object.values(FILE_ERROR)) {
    assert.ok(ZH[label], `zh missing: ${label}`);
    assert.ok(ZH[detail], `zh missing: ${detail}`);
  }
  for (const text of ["Choose another file", "Import failed", "This file could not be imported. Try again, or choose another file."]) assert.ok(ZH[text], text);
});

// #154 -- a flagged duplicate says how the email and phone actually compare; one side missing is never "differs".
import { contactFacts, compareContacts } from "../../src/features/imports/importOutcome.ts";

const flagged = (duplicateContact) => ({ id: "i", fileName: "f", sizeKB: 1, status: "needs_review", outcome: "possible_same_person", duplicateReviewId: "d", duplicateContact });

test("#154 AC-1: same email and same phone never read as different contact details", () => {
  const d = describeItem(flagged({ email: "same", phone: "same" }));
  assert.deepEqual(d.facts, ["Same email", "Same phone number"]);
  assert.doesNotMatch(`${d.detail} ${d.facts.join(" ")}`, /differ/i);
});

test("#154 AC-2: only the field that differs is called different; a missing value is called missing", () => {
  assert.deepEqual(contactFacts({ email: "same", phone: "different" }), ["Same email", "Phone number differs"]);
  assert.deepEqual(contactFacts({ email: "different", phone: "same" }), ["Email differs", "Same phone number"]);
  assert.deepEqual(contactFacts({ email: "different", phone: "different" }), ["Email differs", "Phone number differs"]);
  assert.deepEqual(contactFacts({ email: "same", phone: "missing_uploaded" }), ["Same email", "No phone number in this upload"]);
  assert.deepEqual(contactFacts({ email: "missing_existing", phone: "missing_both" }), ["No email on the existing candidate"]);
  // The page's own comparison for older checks agrees: case and phone formatting don't make a difference.
  assert.deepEqual(compareContacts({ email: "Nina@Example.com", phone: "+1 (415) 555-0134" }, { email: "nina@example.com", phone: "+14155550134" }), { email: "same", phone: "same" });
  assert.deepEqual(compareContacts({ email: "nina@example.com" }, { email: "nina@example.com", phone: "+14155550134" }), { email: "same", phone: "missing_uploaded" });
});

test("#154 AC-3: every phrase, and the reworded duplicate copy, has its Chinese text", () => {
  const phrases = [
    ...contactFacts({ email: "same", phone: "different" }), ...contactFacts({ email: "missing_uploaded", phone: "missing_existing" }),
    ...contactFacts({ email: "different", phone: "same" }), ...contactFacts({ email: "missing_existing", phone: "missing_uploaded" }),
    describeItem(flagged()).detail, describeItem({ ...flagged(), outcome: "new_resume_version" }).detail,
  ];
  for (const phrase of phrases) assert.ok(ZH[phrase], phrase);
  assert.ok(!Object.keys(ZH).some((key) => /contact details differ|contact information differs/.test(key)), "the fixed claim is gone");
});
