/**
 * Ported from the old project's `lib/doubaoinput-stream.mts`, trimmed to what this simpler Copilot
 * panel needs: the SSE-style JSON protocol to the voice gateway (`ready`/`partial`/`final`/`closed`/
 * `error`), a silence watchdog, and a merge helper for folding transcripts into the composer text. The
 * i18n-coupled control-presentation helper and the fused "Enter ends voice and submits" composer logic
 * weren't ported — this panel's mic button and Send button are separate controls, so that fusion isn't
 * needed here.
 */
import { API_BASE_URL } from "./apiBase";

export type VoiceStreamServerEvent =
  | { type: "ready" }
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: "closed" }
  | { type: "error"; code: string; message: string; retryable: boolean };

type TicketResponse = { ticket: string; expiresAt: string };

type SocketEventListener = (event: { data?: unknown }) => void;

export type VoiceStreamSocket = {
  binaryType: string;
  readyState: number;
  addEventListener: (type: string, listener: SocketEventListener) => void;
  send: (value: string | ArrayBuffer) => void;
  close: (code?: number) => void;
};

type StreamOptions = {
  pageUrl: string;
  fetchTicket?: () => Promise<TicketResponse>;
  createWebSocket?: (url: string) => VoiceStreamSocket;
  onReady?: () => void;
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string, retryable: boolean) => void;
  onClosed?: () => void;
};

type VoiceSilenceTimer = unknown;

type VoiceSilenceWatchdogOptions = {
  onTimeout: () => void;
  schedule?: (callback: () => void, delay: number) => VoiceSilenceTimer;
  cancel?: (timer: VoiceSilenceTimer) => void;
};

export function createVoiceSilenceWatchdog(options: VoiceSilenceWatchdogOptions) {
  const schedule = options.schedule || ((callback: () => void, delay: number) => globalThis.setTimeout(callback, delay));
  const cancel = options.cancel || ((timer: VoiceSilenceTimer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>));
  let timer: VoiceSilenceTimer | null = null;
  let active = false;
  const restart = () => {
    if (!active) return;
    if (timer !== null) cancel(timer);
    timer = schedule(() => {
      timer = null;
      active = false;
      options.onTimeout();
    }, 10_000);
  };
  return {
    start() {
      active = true;
      restart();
    },
    markActivity: restart,
    observeAudioLevel(level: number) {
      if (Number.isFinite(level) && level >= 0.08) restart();
    },
    stop() {
      active = false;
      if (timer === null) return;
      cancel(timer);
      timer = null;
    },
  };
}

export function waitForVoiceInputUiPaint(
  scheduleFrame: (callback: FrameRequestCallback) => number = (callback) => globalThis.requestAnimationFrame(callback),
): Promise<void> {
  return new Promise((resolve) => {
    scheduleFrame(() => {
      scheduleFrame(() => resolve());
    });
  });
}

export function mergeVoiceTranscript(base: string, transcript: string): string {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) return base;
  const cleanBase = base.trimEnd();
  return `${cleanBase}${cleanBase.trim() ? " " : ""}${cleanTranscript}`;
}

export function resolveVoiceStreamUrl(pageUrl: string): string {
  const page = new URL(pageUrl);
  const target = new URL(page.origin);
  target.protocol = page.protocol === "https:" ? "wss:" : "ws:";
  target.pathname = `${API_BASE_URL}ws/voice-stream`;
  target.search = "";
  target.hash = "";
  return target.toString().replace(/\/$/, "");
}

export function parseVoiceStreamEvent(raw: string): VoiceStreamServerEvent {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Invalid voice stream event");
  }
  if (!isRecord(value) || typeof value.type !== "string") throw new Error("Invalid voice stream event");
  if (value.type === "ready" || value.type === "closed") return { type: value.type };
  if ((value.type === "partial" || value.type === "final") && typeof value.text === "string" && value.text.trim()) {
    return { type: value.type, text: value.text.trim() };
  }
  if (
    value.type === "error"
    && typeof value.code === "string"
    && typeof value.message === "string"
    && typeof value.retryable === "boolean"
  ) {
    return { type: "error", code: value.code, message: value.message, retryable: value.retryable };
  }
  throw new Error("Invalid voice stream event");
}

export class VoiceStream {
  private ready = false;
  private committed = false;
  private readonly socket: VoiceStreamSocket;
  private readonly options: StreamOptions;

  constructor(socket: VoiceStreamSocket, options: StreamOptions) {
    this.socket = socket;
    this.options = options;
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "start", version: 1, sample_rate: 16000, bits: 16, channels: 1 }));
    });
    socket.addEventListener("message", (message) => this.receive(message.data));
    socket.addEventListener("error", () => options.onError("流式语音连接中断，请重新开始。", true));
    socket.addEventListener("close", () => options.onClosed?.());
  }

  appendPcm(audio: ArrayBuffer): void {
    if (!this.ready || this.committed || this.socket.readyState !== 1) {
      throw new Error("Voice stream is not ready");
    }
    if (audio.byteLength > 0) this.socket.send(audio);
  }

  commit(): void {
    if (!this.ready || this.committed || this.socket.readyState !== 1) {
      throw new Error("Voice stream is not ready");
    }
    this.committed = true;
    this.socket.send(JSON.stringify({ type: "commit" }));
  }

  cancel(): void {
    if (this.socket.readyState === 1 && !this.committed) {
      this.socket.send(JSON.stringify({ type: "cancel" }));
    }
    this.committed = true;
  }

  close(): void {
    this.socket.close(1000);
  }

  private receive(raw: unknown): void {
    if (typeof raw !== "string") {
      this.options.onError("流式语音服务返回了无效消息。", true);
      return;
    }
    let event: VoiceStreamServerEvent;
    try {
      event = parseVoiceStreamEvent(raw);
    } catch {
      this.options.onError("流式语音服务返回了无效消息。", true);
      return;
    }
    if (event.type === "ready") {
      this.ready = true;
      this.options.onReady?.();
    } else if (event.type === "partial") {
      this.options.onPartial(event.text);
    } else if (event.type === "final") {
      this.options.onFinal(event.text);
    } else if (event.type === "error") {
      this.options.onError(event.message, event.retryable);
    }
  }
}

export async function openVoiceStream(options: StreamOptions): Promise<VoiceStream> {
  const fetchTicket = options.fetchTicket || defaultFetchTicket;
  const createWebSocket = options.createWebSocket || ((url: string) => new WebSocket(url) as VoiceStreamSocket);
  const ticket = await fetchTicket();
  if (!ticket.ticket || !ticket.expiresAt) throw new Error("流式语音连接票据无效。");
  const url = new URL(resolveVoiceStreamUrl(options.pageUrl));
  url.searchParams.set("ticket", ticket.ticket);
  return new VoiceStream(createWebSocket(url.toString()), options);
}

async function defaultFetchTicket(): Promise<TicketResponse> {
  const response = await fetch(`${API_BASE_URL}api/audio/realtime-ticket`, { method: "POST" });
  if (!response.ok) {
    let detail = "流式语音输入暂不可用。";
    try {
      const value: unknown = await response.json();
      if (isRecord(value) && typeof value.message === "string") detail = value.message;
    } catch {
      // Keep the stable user-facing fallback.
    }
    throw new Error(detail);
  }
  return response.json() as Promise<TicketResponse>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
