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
