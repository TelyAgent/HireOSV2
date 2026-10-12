/** Same limit the upload pipeline enforces server-side; folder imports skip larger files up front. */
export const MAX_RESUME_BYTES = 25 * 1024 * 1024;

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
