import type { CorporateMailbox, MailboxProvider } from "../fixtures/corporateMailbox";
import { apiFetch } from "./shared";

export async function listCorporateMailboxes(): Promise<CorporateMailbox[]> {
  return apiFetch<CorporateMailbox[]>("/settings/corporate-mailboxes");
}

export interface MailboxFormInput {
  name?: string;
  provider: MailboxProvider;
  email: string;
  password?: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  mailbox: string;
  purposes: { inbound: boolean; outbound: boolean };
}

export interface MailboxCheck {
  code: "imap" | "smtp";
  level: "pass" | "fail";
  message: string;
}

export interface MailboxTestResult {
  verdict: "pass" | "fail";
  checks: MailboxCheck[];
}

/** Runs IMAP/SMTP checks against the submitted values without saving -- lets the
 * drawer's "测试连通性" button catch a bad host/port/password before committing.
 * Works before an account exists yet, so `id` is optional. */
export async function testCorporateMailbox(input: MailboxFormInput, id?: string): Promise<MailboxTestResult> {
  void id;
  return apiFetch<MailboxTestResult>("/settings/corporate-mailboxes/test", { method: "POST", body: JSON.stringify(input) });
}

/** The password (app password / auth code) is write-only: leaving it blank on an
 * update keeps whatever was saved before -- it's never echoed back either. */
export async function createCorporateMailbox(input: MailboxFormInput): Promise<CorporateMailbox> {
  return apiFetch<CorporateMailbox>("/settings/corporate-mailboxes", { method: "POST", body: JSON.stringify(input) });
}

export async function updateCorporateMailbox(id: string, input: MailboxFormInput): Promise<CorporateMailbox> {
  return apiFetch<CorporateMailbox>(`/settings/corporate-mailboxes/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function deleteCorporateMailbox(id: string): Promise<void> {
  await apiFetch(`/settings/corporate-mailboxes/${id}`, { method: "DELETE" });
}

export async function setCorporateMailboxEnabled(id: string, enabled: boolean): Promise<CorporateMailbox> {
  return apiFetch<CorporateMailbox>(`/settings/corporate-mailboxes/${id}/enabled`, { method: "POST", body: JSON.stringify({ enabled }) });
}

export async function syncCorporateMailbox(id: string): Promise<CorporateMailbox & { recentMessages: { id: string; from: string; subject: string; date: string | null }[] }> {
  return apiFetch(`/settings/corporate-mailboxes/${id}/sync`, { method: "POST" });
}

export interface MailboxImportResult {
  mailbox: CorporateMailbox;
  messagesScanned: number;
  attachmentsImported: number;
  batchId?: string;
}

/** Pulls resume-looking attachments out of unseen mail into the Resume Library
 * via the normal import pipeline -- this is what the "Import from email" tab's
 * "立即读取" button calls, distinct from the lightweight `syncCorporateMailbox`
 * status check used on the Preferences page. */
export async function importFromMailbox(id: string): Promise<MailboxImportResult> {
  return apiFetch<MailboxImportResult>(`/settings/corporate-mailboxes/${id}/import`, { method: "POST" });
}
