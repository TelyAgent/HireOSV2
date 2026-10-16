/**
 * How an intake channel reads in the UI (#161 #176): the stored value (e.g. `manual_upload`, `paste`) is never
 * shown as is, and nothing is guessed — a value we don't know reads as "Other source", a missing one as
 * "Source unknown". The stored value itself is never changed.
 */
const SOURCE_LABEL: Record<string, string> = {
  manual_upload: "Manual upload",
  paste: "Paste",
  email: "Email",
  folder: "Folder",
  api: "API",
  manual: "Manual entry",
  structured_entry: "Manual entry",
  // Labels some older records stored instead of a channel.
  "Manual upload": "Manual upload",
  "Structured entry": "Manual entry",
  "Resume Library": "Resume Library",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source || !source.trim()) return "Source unknown";
  return SOURCE_LABEL[source] ?? "Other source";
}
