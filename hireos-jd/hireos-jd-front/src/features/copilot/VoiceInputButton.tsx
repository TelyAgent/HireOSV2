import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Icon } from "../../components/ui/Icons";
import { useStore } from "../../store/StoreContext";
import { createVoiceAudioCapture } from "../../lib/voice-audio-capture";
import { createVoiceSilenceWatchdog, openVoiceStream, waitForVoiceInputUiPaint, type VoiceStream } from "../../lib/voice-stream";

/**
 * Real streaming voice input, replacing the panel's old typewriter-simulated mic button. Ported from
 * the old project's `voice-input-button.tsx`, trimmed down: no audio-level waveform visualization and
 * no external imperative ref API (this panel's mic button is self-contained — nothing outside it needs
 * to start/stop a session programmatically), since neither is needed here. The session-guarding logic
 * (a bumped `sessionRef` counter that stale async callbacks check before touching state) is kept as-is
 * — it's there to prevent a slow `getUserMedia`/WebSocket handshake from clobbering state after the
 * user has already cancelled or started a new session.
 *
 * Startup is optimistic: the mic goes live (status "listening") as soon as local audio is ready, while
 * the ticket + WebSocket + upstream ASR handshake runs in parallel. PCM captured before the gateway's
 * `ready` is buffered and flushed once it arrives, so the user can start talking immediately and the
 * first words aren't lost. The AudioContext (and its loaded worklet module) is kept across sessions —
 * suspended while idle — instead of being rebuilt on every click.
 */
function browserSupportsVoiceStreaming(): boolean {
  return typeof window !== "undefined"
    && typeof AudioContext !== "undefined"
    && typeof WebSocket !== "undefined"
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

function microphoneErrorMessage(error: unknown, t: (source: string) => string): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") return t("Microphone access was denied.");
  if (error instanceof DOMException && error.name === "NotFoundError") return t("No microphone was found.");
  if (error instanceof Error && error.message) return error.message;
  return t("Couldn't start voice input.");
}

// Upper bound on audio buffered while the voice connection is still being set up (~60 s at 16 kHz/16-bit).
const MAX_PENDING_PCM_BYTES = 16_000 * 2 * 60;

export type VoiceInputStatus = "idle" | "connecting" | "listening";

export type VoiceInputHandle = {
  /**
   * Stops the current session the same way the button does. Returns "pending" when the transcript will
   * still arrive later via `onTranscript`/`onError` (stopped before the connection was ready), "ended"
   * when the session is over and any transcript has already been delivered synchronously.
   */
  stop: () => "pending" | "ended";
};

export function VoiceInputButton({
  disabled = false,
  onPartialTranscript,
  onTranscript,
  onError,
  onStatusChange,
  onAudioLevelChange,
  className = "gm-mic-btn",
  ref,
}: {
  ref?: Ref<VoiceInputHandle>;
  disabled?: boolean;
  /** Button style; "listening" is appended while recording. */
  className?: string;
  onPartialTranscript: (transcript: string) => void;
  onTranscript: (transcript: string) => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: VoiceInputStatus) => void;
  onAudioLevelChange?: (level: number) => void;
}) {
  const { t } = useStore();
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioCaptureRef = useRef<AudioNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserFrameRef = useRef<number | null>(null);
  const voiceStreamRef = useRef<VoiceStream | null>(null);
  const sessionRef = useRef(0);
  const activeSessionRef = useRef(false);
  const latestPartialTranscriptRef = useRef("");
  const reachedListeningRef = useRef(false);
  // Set once the gateway reports `ready`; until then captured PCM goes to `pendingPcmRef`.
  const streamReadyRef = useRef(false);
  const pendingPcmRef = useRef<ArrayBuffer[]>([]);
  const pendingPcmBytesRef = useRef(0);
  // The user pressed stop before `ready`: flush the buffered audio and `commit` once ready instead.
  const finalizeOnReadyRef = useRef(false);
  const silenceWatchdogRef = useRef<ReturnType<typeof createVoiceSilenceWatchdog> | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    onStatusChange?.(listening ? "listening" : connecting ? "connecting" : "idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting, listening]);

  const resetSessionBuffers = useCallback(() => {
    streamReadyRef.current = false;
    finalizeOnReadyRef.current = false;
    pendingPcmRef.current = [];
    pendingPcmBytesRef.current = 0;
  }, []);

  /** Stops the mic and tears down this session's audio graph; the shared AudioContext is only suspended. */
  const cleanupAudio = useCallback(() => {
    silenceWatchdogRef.current?.stop();
    silenceWatchdogRef.current = null;
    if (analyserFrameRef.current !== null) cancelAnimationFrame(analyserFrameRef.current);
    analyserFrameRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    audioCaptureRef.current?.disconnect();
    audioCaptureRef.current = null;
    audioGainRef.current?.disconnect();
    audioGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const audioContext = audioContextRef.current;
    if (audioContext && audioContext.state === "running") void audioContext.suspend().catch(() => undefined);
    onAudioLevelChange?.(0);
  }, [onAudioLevelChange]);

  const closeVoiceStream = useCallback((cancel: boolean) => {
    const voiceStream = voiceStreamRef.current;
    voiceStreamRef.current = null;
    if (!voiceStream) return;
    try {
      if (cancel) voiceStream.cancel();
    } catch {
      // Local capture is already stopped; an upstream send failure cannot block ending.
    }
    try {
      voiceStream.close();
    } catch {
      // The socket may already be closed by the gateway.
    }
  }, []);

  const finishWithError = useCallback((message: string) => {
    activeSessionRef.current = false;
    latestPartialTranscriptRef.current = "";
    sessionRef.current += 1;
    resetSessionBuffers();
    setConnecting(false);
    setListening(false);
    cleanupAudio();
    closeVoiceStream(true);
    onError?.(message);
  }, [cleanupAudio, closeVoiceStream, onError, resetSessionBuffers]);

  useEffect(() => () => {
    activeSessionRef.current = false;
    sessionRef.current += 1;
    cleanupAudio();
    closeVoiceStream(true);
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close();
  }, [cleanupAudio, closeVoiceStream]);

  const startStreaming = useCallback(async () => {
    if (activeSessionRef.current) return;
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    activeSessionRef.current = true;
    latestPartialTranscriptRef.current = "";
    reachedListeningRef.current = false;
    resetSessionBuffers();
    setConnecting(true);
    setListening(false);

    const sendPcm = (audio: ArrayBuffer) => {
      const voiceStream = voiceStreamRef.current;
      if (sessionRef.current !== session || !voiceStream) return;
      try {
        voiceStream.appendPcm(audio);
      } catch {
        finishWithError(t("Voice connection lost. Please try again."));
      }
    };

    // Started right away and awaited at the end, so the network handshake overlaps local mic setup.
    let voiceStream: VoiceStream | null = null;
    const voiceStreamPromise = openVoiceStream({
      pageUrl: window.location.href,
      onReady: () => {
        if (sessionRef.current !== session || !voiceStream) return;
        voiceStreamRef.current = voiceStream;
        streamReadyRef.current = true;
        const pending = pendingPcmRef.current;
        pendingPcmRef.current = [];
        pendingPcmBytesRef.current = 0;
        for (const audio of pending) {
          sendPcm(audio);
          if (sessionRef.current !== session) return;
        }
        if (finalizeOnReadyRef.current) {
          // Mic already stopped; let the server finalize the buffered audio and wait for `final`.
          try {
            voiceStream.commit();
          } catch {
            finishWithError(t("Voice connection lost. Please try again."));
          }
          return;
        }
        reachedListeningRef.current = true;
        const silenceWatchdog = createVoiceSilenceWatchdog({
          onTimeout: () => {
            if (sessionRef.current === session) endStreamingImmediately();
          },
        });
        silenceWatchdogRef.current = silenceWatchdog;
        silenceWatchdog.start();
      },
      onPartial: (text) => {
        if (sessionRef.current === session) {
          silenceWatchdogRef.current?.markActivity();
          latestPartialTranscriptRef.current = text;
          onPartialTranscript(text);
        }
      },
      onFinal: (text) => {
        if (sessionRef.current !== session) return;
        activeSessionRef.current = false;
        latestPartialTranscriptRef.current = "";
        resetSessionBuffers();
        onTranscript(text);
        setConnecting(false);
        setListening(false);
        cleanupAudio();
        closeVoiceStream(false);
      },
      onError: (message) => {
        if (sessionRef.current === session) finishWithError(message);
      },
      onClosed: () => {
        if (sessionRef.current === session && activeSessionRef.current) finishWithError(t("Voice input disconnected."));
      },
    }).then((opened) => {
      voiceStream = opened;
      if (sessionRef.current !== session) {
        opened.cancel();
        opened.close();
        return;
      }
      voiceStreamRef.current = opened;
    });
    // Avoid an unhandled rejection if mic setup fails first; the real error is surfaced below.
    voiceStreamPromise.catch(() => undefined);

    try {
      await waitForVoiceInputUiPaint();
      if (sessionRef.current !== session) return;
      let audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContext();
        audioContextRef.current = audioContext;
      }
      if (audioContext.state === "suspended") await audioContext.resume();
      // Explicitly disabled, not just omitted: browsers default these processing constraints to `true`
      // even when the request just says `audio: true`. On some hardware/driver combinations they make
      // the browser hand back a track that reports as live but only ever delivers silent (all-zero)
      // samples — confirmed on real hardware during development, where a raw `<audio>` element playing
      // the unprocessed track was silent until echoCancellation was explicitly turned off.
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (sessionRef.current !== session) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = mediaStream;
      const capture = await createVoiceAudioCapture({
        audioContext,
        pageOrigin: window.location.origin,
        onPcm: (audio) => {
          if (sessionRef.current !== session) return;
          if (streamReadyRef.current) {
            sendPcm(audio);
            return;
          }
          if (pendingPcmBytesRef.current + audio.byteLength > MAX_PENDING_PCM_BYTES) return;
          pendingPcmRef.current.push(audio);
          pendingPcmBytesRef.current += audio.byteLength;
        },
      });
      if (sessionRef.current !== session) {
        capture.node.disconnect();
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      const audioSource = audioContext.createMediaStreamSource(mediaStream);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 32;
      const analyserSamples = new Uint8Array(analyser.fftSize);
      audioSourceRef.current = audioSource;
      audioCaptureRef.current = capture.node;
      audioGainRef.current = silentGain;
      analyserRef.current = analyser;
      audioSource.connect(capture.node);
      audioSource.connect(analyser);
      capture.node.connect(silentGain);
      silentGain.connect(audioContext.destination);
      setConnecting(false);
      setListening(true);
      const sampleLevel = () => {
        analyser.getByteTimeDomainData(analyserSamples);
        const squareSum = analyserSamples.reduce((total, sample) => total + ((sample - 128) / 128) ** 2, 0);
        const level = Math.min(1, Math.sqrt(squareSum / analyserSamples.length) * 7);
        onAudioLevelChange?.(level);
        analyserFrameRef.current = requestAnimationFrame(sampleLevel);
      };
      sampleLevel();
      await voiceStreamPromise;
    } catch (reason) {
      if (sessionRef.current === session) finishWithError(microphoneErrorMessage(reason, t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAudio, closeVoiceStream, finishWithError, onAudioLevelChange, onPartialTranscript, onTranscript, resetSessionBuffers, t]);

  // Manually stopping (button press or silence timeout) never waits for a proper `commit`/`final`
  // round trip — it takes whatever partial transcript has arrived so far and cancels immediately, for
  // a stop that feels instant. The exception is stopping before the connection is ready while audio
  // is already buffered: there is no partial yet, so the buffered audio is flushed on `ready` and
  // finalized with `commit()`, and the button shows "connecting" until the final transcript arrives.
  const endStreamingImmediately = useCallback(() => {
    if (!activeSessionRef.current) return;
    if (!streamReadyRef.current && pendingPcmBytesRef.current > 0) {
      if (finalizeOnReadyRef.current) {
        // Second press while waiting: give up on this utterance.
        activeSessionRef.current = false;
        sessionRef.current += 1;
        resetSessionBuffers();
        setConnecting(false);
        setListening(false);
        cleanupAudio();
        closeVoiceStream(true);
        return;
      }
      finalizeOnReadyRef.current = true;
      cleanupAudio();
      setListening(false);
      setConnecting(true);
      return;
    }
    const partialTranscript = latestPartialTranscriptRef.current;
    const reachedListening = reachedListeningRef.current;
    activeSessionRef.current = false;
    latestPartialTranscriptRef.current = "";
    sessionRef.current += 1;
    resetSessionBuffers();
    setConnecting(false);
    setListening(false);
    cleanupAudio();
    closeVoiceStream(true);
    if (partialTranscript) {
      onTranscript(partialTranscript);
    } else if (reachedListening) {
      // Ending with zero transcript used to fail silently — the mic session would just quietly return
      // to idle with no feedback at all, which is indistinguishable from the feature doing nothing.
      onError?.(t("No speech was recognized. Check that the right microphone is selected and try again."));
    }
  }, [cleanupAudio, closeVoiceStream, onError, onTranscript, resetSessionBuffers, t]);

  useImperativeHandle(ref, () => ({
    stop: () => {
      endStreamingImmediately();
      return activeSessionRef.current ? "pending" : "ended";
    },
  }), [endStreamingImmediately]);

  const supported = browserSupportsVoiceStreaming();
  const active = connecting || listening;
  const title = !supported
    ? t("Voice input isn't supported in this browser.")
    : connecting
      ? t("Connecting…")
      : listening
        ? t("Listening… tap to stop")
        : t("Speak");

  return (
    <button
      className={`${className}${active ? " listening" : ""}`}
      type="button"
      disabled={!supported || (disabled && !active)}
      aria-pressed={active}
      aria-busy={connecting || undefined}
      title={title}
      onClick={() => {
        if (activeSessionRef.current) endStreamingImmediately();
        else void startStreaming();
      }}
    >
      <Icon name={active ? "stop" : "mic"} />
    </button>
  );
}
