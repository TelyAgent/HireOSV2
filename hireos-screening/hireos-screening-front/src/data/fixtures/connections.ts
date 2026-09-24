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
