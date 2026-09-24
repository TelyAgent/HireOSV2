import { daysAgo, hoursAgo } from "../../lib/daysAgo";

export type ConnectionKind = "email" | "folder" | "api";
export type ConnectionStatus = "connected" | "watching" | "authorization_required" | "paused";

export interface Connection {
  id: string;
  kind: ConnectionKind;
  name: string;
  account: string;
  status: ConnectionStatus;
  lastRead: string;
  scope: string;
}

export const CONNECTIONS: Connection[] = [
  { id: "conn-1", kind: "email", name: "Recruiting intake mailbox", account: "recruiting-intake@hireos.demo", status: "connected", lastRead: hoursAgo(3), scope: "Inbox, last 30 days + new mail" },
  { id: "conn-2", kind: "email", name: "Hiring manager referrals mailbox", account: "referrals@hireos.demo", status: "authorization_required", lastRead: daysAgo(6), scope: "Inbox, new mail only" },
  { id: "conn-3", kind: "folder", name: "Shared Drive — Recruiting/Resumes", account: "/Shared Drives/Recruiting/Resumes", status: "watching", lastRead: hoursAgo(1), scope: "Includes subfolders" },
  { id: "conn-4", kind: "api", name: "Demo ingestion endpoint", account: "API token ••••-8841", status: "connected", lastRead: daysAgo(2), scope: "candidate.import events" },
];
