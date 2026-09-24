export type MailboxProvider = "gmail" | "outlook" | "qq" | "163" | "126" | "custom";

export interface CorporateMailbox {
  id: string;
  configured: boolean;
  enabled: boolean;
  name?: string;
  email?: string;
  provider?: MailboxProvider;
  hasPassword?: boolean;
  imapHost?: string;
  imapPort?: number;
  imapTls?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  mailbox?: string;
  purposes: { inbound: boolean; outbound: boolean };
  status?: "active" | "inactive";
  connectedAt?: string | null;
  lastSyncedAt?: string | null;
  lastSyncMessageCount?: number | null;
}

export const CORPORATE_MAILBOXES: CorporateMailbox[] = [];
