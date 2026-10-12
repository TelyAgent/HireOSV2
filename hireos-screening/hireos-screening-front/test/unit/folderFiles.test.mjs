// Unit tests for the folder-import file selection and batching (Issue #11).
// Node 24 strips the TypeScript types when importing the .ts module directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkForUpload, runWithConcurrency, selectFolderFiles, skippedTotal, MAX_RESUME_BYTES } from "../../src/features/imports/folderFiles.ts";

const MB = 1024 * 1024;
/** A File as returned by <input webkitdirectory>: name, relative path and a size. */
function picked(path, size = 10) {
  const file = new File([], path.split("/").pop());
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

test("keeps pdf/docx/txt in any case and in subfolders", () => {
  const r = selectFolderFiles([picked("R/a.pdf"), picked("R/B.DOCX"), picked("R/sub/c.TxT"), picked("R/sub/deep/d.Pdf")]);
  assert.deepEqual(r.accepted.map((f) => f.webkitRelativePath), ["R/a.pdf", "R/B.DOCX", "R/sub/c.TxT", "R/sub/deep/d.Pdf"]);
  assert.equal(skippedTotal(r), 0);
});

test("skips other formats, hidden files and folders, and Office lock files", () => {
  const r = selectFolderFiles([
    picked("R/x.doc"), picked("R/img.png"), picked("R/README"), picked("R/a.pdf.zip"),
    picked("R/.DS_Store"), picked("R/.hidden.pdf"), picked("R/.git/notes.txt"), picked("R/~$cv.docx"), picked("R/sub/~$x.pdf"),
  ]);
  assert.equal(r.accepted.length, 0);
  assert.deepEqual(r.skipped, { unsupported: 4, hidden: 5, tooLarge: 0 });
});

test("the 20 MB limit (minus multipart headroom) is inclusive", () => {
  const r = selectFolderFiles([picked("R/edge.pdf", MAX_RESUME_BYTES), picked("R/big.pdf", MAX_RESUME_BYTES + 1)]);
  assert.deepEqual(r.accepted.map((f) => f.name), ["edge.pdf"]);
  assert.equal(r.skipped.tooLarge, 1);
});

test("batches respect the 20-file limit and keep order", () => {
  const files = Array.from({ length: 45 }, (_, i) => picked(`R/${i}.pdf`));
  const batches = chunkForUpload(files);
  assert.deepEqual(batches.map((b) => b.length), [20, 20, 5]);
  assert.deepEqual(batches.flat(), files);
});

test("batches respect the byte budget; an oversized file gets its own batch", () => {
  const files = [picked("R/a.pdf", 10 * MB), picked("R/b.pdf", 7 * MB), picked("R/c.pdf", 2 * MB), picked("R/d.pdf", 19 * MB), picked("R/e.pdf", 1 * MB)];
  assert.deepEqual(chunkForUpload(files).map((b) => b.map((f) => f.name)), [["a.pdf", "b.pdf"], ["c.pdf"], ["d.pdf"], ["e.pdf"]]);
  assert.deepEqual(chunkForUpload([]), []);
});

test("runWithConcurrency never exceeds the limit and runs every item once", async () => {
  let running = 0, peak = 0; const seen = [];
  await runWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
    running++; peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5 * (6 - n)));
    seen.push(n); running--;
  });
  assert.equal(peak, 2);
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5]);
  await runWithConcurrency([], 2, async () => assert.fail("no items"));
});
