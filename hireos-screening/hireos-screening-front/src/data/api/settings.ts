import { db } from "../db";
import { uid } from "../../lib/daysAgo";
import type { CorporateMailbox, MailboxProvider } from "../fixtures/corporateMailbox";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

export async function listCorporateMailboxes(): Promise<CorporateMailbox[]> {
  if (isRealApi()) return apiFetch<CorporateMailbox[]>("/settings/corporate-mailboxes");
  await delay();
  return db.corporateMailboxes;
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

function mockVerify(input: MailboxFormInput, existing?: CorporateMailbox) {
  const hasPassword = Boolean(input.password?.trim()) || Boolean(existing?.hasPassword);
  if (!hasPassword) throw new ApiError("CREDENTIALS_REQUIRED", "An authorization code / password is required.");
  return hasPassword;
}

/** Runs IMAP/SMTP checks against the submitted values without saving -- lets the
 * drawer's "测试连通性" button catch a bad host/port/password before committing.
 * Works before an account exists yet, so `id` is optional. */
export async function testCorporateMailbox(input: MailboxFormInput, id?: string): Promise<MailboxTestResult> {
  if (isRealApi()) return apiFetch<MailboxTestResult>("/settings/corporate-mailboxes/test", { method: "POST", body: JSON.stringify(input) });
  await delay(600);
  const existing = id ? db.corporateMailboxes.find((m) => m.id === id) : undefined;
  mockVerify(input, existing);
  const checks: MailboxCheck[] = [];
  if (input.purposes.inbound) checks.push({ code: "imap", level: "pass", message: "连接成功，收件箱共 12 封邮件。" });
  if (input.purposes.outbound) checks.push({ code: "smtp", level: "pass", message: "SMTP 认证成功，可以发信。" });
  return { verdict: "pass", checks };
}

function toMailbox(id: string, input: MailboxFormInput, existing?: CorporateMailbox): CorporateMailbox {
  return {
    id,
    configured: true,
    enabled: existing?.enabled ?? true,
    name: input.name || input.email,
    email: input.email,
    provider: input.provider,
    hasPassword: Boolean(input.password?.trim()) || Boolean(existing?.hasPassword),
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapTls: input.imapTls,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    mailbox: input.mailbox,
    purposes: input.purposes,
    status: "active",
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    lastSyncedAt: existing?.lastSyncedAt || null,
    lastSyncMessageCount: existing?.lastSyncMessageCount ?? null,
  };
}

/** The password (app password / auth code) is write-only: leaving it blank on an
 * update keeps whatever was saved before -- it's never echoed back either. */
export async function createCorporateMailbox(input: MailboxFormInput): Promise<CorporateMailbox> {
  if (isRealApi()) return apiFetch<CorporateMailbox>("/settings/corporate-mailboxes", { method: "POST", body: JSON.stringify(input) });
  await delay(500);
  mockVerify(input);
  const mailbox = toMailbox(uid("mbx"), input);
  db.corporateMailboxes = [...db.corporateMailboxes, mailbox];
  return mailbox;
}

export async function updateCorporateMailbox(id: string, input: MailboxFormInput): Promise<CorporateMailbox> {
  if (isRealApi()) return apiFetch<CorporateMailbox>(`/settings/corporate-mailboxes/${id}`, { method: "PUT", body: JSON.stringify(input) });
  await delay(500);
  const existing = db.corporateMailboxes.find((m) => m.id === id);
  if (!existing) throw new ApiError("NOT_FOUND", `Mailbox ${id} not found`);
  mockVerify(input, existing);
  const mailbox = toMailbox(id, input, existing);
  db.corporateMailboxes = db.corporateMailboxes.map((m) => (m.id === id ? mailbox : m));
  return mailbox;
}

export async function deleteCorporateMailbox(id: string): Promise<void> {
  if (isRealApi()) {
    await apiFetch(`/settings/corporate-mailboxes/${id}`, { method: "DELETE" });
    return;
  }
  await delay(300);
  db.corporateMailboxes = db.corporateMailboxes.filter((m) => m.id !== id);
}

export async function setCorporateMailboxEnabled(id: string, enabled: boolean): Promise<CorporateMailbox> {
  if (isRealApi()) return apiFetch<CorporateMailbox>(`/settings/corporate-mailboxes/${id}/enabled`, { method: "POST", body: JSON.stringify({ enabled }) });
  await delay(300);
  const existing = db.corporateMailboxes.find((m) => m.id === id);
  if (!existing) throw new ApiError("NOT_FOUND", `Mailbox ${id} not found`);
  const mailbox = { ...existing, enabled };
  db.corporateMailboxes = db.corporateMailboxes.map((m) => (m.id === id ? mailbox : m));
  return mailbox;
}

export async function syncCorporateMailbox(id: string): Promise<CorporateMailbox & { recentMessages: { id: string; from: string; subject: string; date: string | null }[] }> {
  if (isRealApi()) return apiFetch(`/settings/corporate-mailboxes/${id}/sync`, { method: "POST" });
  const existing = db.corporateMailboxes.find((m) => m.id === id);
  if (!existing) throw new ApiError("NOT_CONFIGURED", "Corporate mailbox is not configured");
  await delay(700);
  const mailbox = { ...existing, lastSyncedAt: new Date().toISOString(), lastSyncMessageCount: 3 };
  db.corporateMailboxes = db.corporateMailboxes.map((m) => (m.id === id ? mailbox : m));
  return { ...mailbox, recentMessages: [] };
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
  if (isRealApi()) return apiFetch<MailboxImportResult>(`/settings/corporate-mailboxes/${id}/import`, { method: "POST" });
  const existing = db.corporateMailboxes.find((m) => m.id === id);
  if (!existing) throw new ApiError("NOT_FOUND", `Mailbox ${id} not found`);
  await delay(700);
  const mailbox = { ...existing, lastSyncedAt: new Date().toISOString(), lastSyncMessageCount: 1 };
  db.corporateMailboxes = db.corporateMailboxes.map((m) => (m.id === id ? mailbox : m));
  return { mailbox, messagesScanned: 1, attachmentsImported: 0 };
}
