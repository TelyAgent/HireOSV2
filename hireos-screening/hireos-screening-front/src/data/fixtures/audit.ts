import { daysAgo } from "../../lib/daysAgo";
import type { PersonId } from "./people";

export interface AuditEntry {
  id: string;
  at: string;
  actor: PersonId;
  action: string;
  object: string;
}

export const AUDIT: AuditEntry[] = [
  { id: "aud-1", at: daysAgo(21), actor: "daniel", action: "Confirmed role criteria", object: "Senior Backend Engineer v3" },
  { id: "aud-2", at: daysAgo(19), actor: "daniel", action: "Confirmed job link", object: "Alex Morgan → Senior Backend Engineer" },
  { id: "aud-3", at: daysAgo(11), actor: "emma", action: "Resolved duplicate review — different person", object: "Alex Morgan (Finance) vs. Alex Morgan (Backend)" },
  { id: "aud-4", at: daysAgo(8), actor: "daniel", action: "Recorded decision — Do not advance", object: "Morgan Blake → Senior Backend Engineer" },
];
