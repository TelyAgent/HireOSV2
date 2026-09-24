export class ApiError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export function isRealApi(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_API_MODE === "real";
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

const BASE_URL = ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL) || "/";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const body = await parseResponse(response) as { code?: string; message?: string } | T;
  if (!response.ok) {
    const errorBody = body as { code?: string; message?: string };
    throw new ApiError(errorBody.code || `HTTP_${response.status}`, errorBody.message || `Request failed (${response.status})`);
  }
  return body as T;
}

export async function apiUpload<T>(
  path: string,
  files: File[],
  fieldName = "files",
  headers?: Record<string, string>,
): Promise<T> {
  const form = new FormData();
  for (const file of files) form.append(fieldName, file, file.name);
  return apiFetch<T>(path, { method: "POST", body: form, headers });
}

/** Simulated network latency — a real backend later replaces this whole layer. */
export function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
