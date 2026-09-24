import type { FileRecord } from "../fixtures/files";
import type { Connection } from "../fixtures/connections";
import type { ActivityEntry } from "../fixtures/activity";
import { ApiError, apiFetch } from "./shared";

export async function listFiles(): Promise<FileRecord[]> {
  return apiFetch<FileRecord[]>("/materials");
}

export async function listConnections(): Promise<Connection[]> {
  return apiFetch<Connection[]>("/connections");
}

export async function listActivity(): Promise<ActivityEntry[]> {
  return apiFetch<ActivityEntry[]>("/activity");
}

export async function readNowConnection(id: string): Promise<Connection> {
  return apiFetch<Connection>(`/connections/${id}/read`, { method: "POST" });
}

export async function reconnectConnection(id: string): Promise<Connection> {
  return apiFetch<Connection>(`/connections/${id}/reconnect`, { method: "POST" });
}

export async function pauseConnection(id: string): Promise<Connection> {
  return apiFetch<Connection>(`/connections/${id}/pause`, { method: "POST" });
}

export async function previewFile(id: string): Promise<FileRecord> {
  const files = await apiFetch<FileRecord[]>("/materials");
  const file = files.find((item) => item.id === id);
  if (!file) throw new ApiError("NOT_FOUND", `File ${id} not found`);
  return file;
}
