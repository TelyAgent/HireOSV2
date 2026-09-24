import { db } from "../db";
import type { FileRecord } from "../fixtures/files";
import type { Connection } from "../fixtures/connections";
import type { ActivityEntry } from "../fixtures/activity";
import { uid } from "../../lib/daysAgo";
import { ApiError, delay } from "./shared";
import { apiFetch, isRealApi } from "./shared";

export async function listFiles(): Promise<FileRecord[]> {
  if (isRealApi()) return apiFetch<FileRecord[]>("/materials");
  await delay();
  return [...db.files].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function listConnections(): Promise<Connection[]> {
  if (isRealApi()) return apiFetch<Connection[]>("/connections");
  await delay();
  return db.connections;
}

export async function listActivity(): Promise<ActivityEntry[]> {
  if (isRealApi()) return apiFetch<ActivityEntry[]>("/activity");
  await delay();
  return [...db.activity].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function findConnection(id: string): Connection {
  const connection = db.connections.find((c) => c.id === id);
  if (!connection) throw new ApiError("NOT_FOUND", `Connection ${id} not found`);
  return connection;
}

export async function readNowConnection(id: string): Promise<Connection> {
  if (isRealApi()) return apiFetch<Connection>(`/connections/${id}/read`, { method: "POST" });
  const connection = findConnection(id);
  if (connection.status === "authorization_required") throw new ApiError("AUTH_REQUIRED", "Authorization required");
  await delay(700);
  connection.lastRead = new Date().toISOString();
  db.activity.unshift({ id: uid("act"), op: connection.kind === "email" ? "Email read" : connection.kind === "folder" ? "Folder scan" : "API import", actor: "System (scheduled)", target: `${connection.name} — read now, 1 new item found`, status: "succeeded", at: new Date().toISOString() });
  return connection;
}

export async function reconnectConnection(id: string): Promise<Connection> {
  if (isRealApi()) return apiFetch<Connection>(`/connections/${id}/reconnect`, { method: "POST" });
  const connection = findConnection(id);
  await delay(700);
  connection.status = connection.kind === "folder" ? "watching" : "connected";
  connection.lastRead = new Date().toISOString();
  return connection;
}

export async function pauseConnection(id: string): Promise<Connection> {
  if (isRealApi()) return apiFetch<Connection>(`/connections/${id}/pause`, { method: "POST" });
  const connection = findConnection(id);
  await delay(400);
  connection.status = "paused";
  return connection;
}

export async function previewFile(id: string): Promise<FileRecord> {
  if (isRealApi()) {
    const files = await apiFetch<FileRecord[]>("/materials");
    const file = files.find((item) => item.id === id);
    if (!file) throw new ApiError("NOT_FOUND", `File ${id} not found`);
    return file;
  }
  await delay(300);
  const file = db.files.find((f) => f.id === id);
  if (!file) throw new ApiError("NOT_FOUND", `File ${id} not found`);
  return file;
}
