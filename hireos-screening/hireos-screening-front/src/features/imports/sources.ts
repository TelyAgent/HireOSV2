/**
 * How an intake channel reads in the UI (#161): the stored value (e.g. `manual_upload`, `paste`) is never shown
 * as is. Unknown values from older records fall back to themselves.
 */
const SOURCE_LABEL: Record<string, string> = { manual_upload: "Manual upload", paste: "Paste", email: "Email", folder: "Folder", api: "API", manual: "Manual entry" };
export function sourceLabel(source: string | null | undefined): string {
  return (source && SOURCE_LABEL[source]) || source || "—";
}
