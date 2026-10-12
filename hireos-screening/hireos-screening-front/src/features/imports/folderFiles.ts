/**
 * Per-file limit shown to users as "20 MB". The gateway rejects request bodies over 20 MB
 * (gateway/nginx.conf), so keep a little headroom for the multipart envelope.
 */
export const MAX_RESUME_BYTES = 20 * 1024 * 1024 - 64 * 1024;

const RESUME_EXTENSIONS = [".pdf", ".docx", ".txt"];

export interface FolderSelection {
  accepted: File[];
  /** Files not imported, split by reason so the summary can say why. */
  skipped: { unsupported: number; hidden: number; tooLarge: number };
}

/** Path segments of a file picked via `<input webkitdirectory>`, e.g. ["Resumes", "2026", "ada.pdf"]. */
function pathSegments(file: File): string[] {
  return (file.webkitRelativePath || file.name).split("/").filter(Boolean);
}

/**
 * Picks the résumés out of everything a folder picker returned (subfolders included).
 * Hidden files and folders (".DS_Store", ".git/…") and Office lock files ("~$cv.docx")
 * are never résumés; oversized files would only be rejected by the server.
 */
export function selectFolderFiles(files: Iterable<File>): FolderSelection {
  const result: FolderSelection = { accepted: [], skipped: { unsupported: 0, hidden: 0, tooLarge: 0 } };
  for (const file of files) {
    const segments = pathSegments(file);
    const name = segments[segments.length - 1] ?? file.name;
    if (segments.some((s) => s.startsWith(".")) || name.startsWith("~$")) {
      result.skipped.hidden++;
    } else if (!RESUME_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) {
      result.skipped.unsupported++;
    } else if (file.size > MAX_RESUME_BYTES) {
      result.skipped.tooLarge++;
    } else {
      result.accepted.push(file);
    }
  }
  return result;
}

export function skippedTotal(selection: FolderSelection): number {
  const { unsupported, hidden, tooLarge } = selection.skipped;
  return unsupported + hidden + tooLarge;
}

/** Backend accepts at most 20 files per import request (FilesInterceptor in intake.controller). */
export const MAX_FILES_PER_BATCH = 20;
/** Gateway caps a request body at 20 MB (gateway/nginx.conf); leave room for multipart overhead. */
export const MAX_BATCH_BYTES = 18 * 1024 * 1024;

/**
 * Splits a folder's résumés into upload batches that each fit the backend's file count and
 * the gateway's body size, keeping the original order. A single file bigger than the byte
 * budget still gets a batch of its own rather than being dropped here.
 */
export function chunkForUpload(files: File[], maxFiles = MAX_FILES_PER_BATCH, maxBytes = MAX_BATCH_BYTES): File[][] {
  const batches: File[][] = [];
  let current: File[] = [];
  let bytes = 0;
  for (const file of files) {
    if (current.length && (current.length >= maxFiles || bytes + file.size > maxBytes)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(file);
    bytes += file.size;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** How many upload batches may be in flight at once, so a large folder doesn't flood the gateway. */
export const MAX_CONCURRENT_BATCHES = 2;

/** Runs `task` over `items` with at most `limit` running at a time; resolves when all finished. */
export async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
