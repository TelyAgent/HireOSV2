import { useCallback, useEffect, useRef, useState } from "react";
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

export type VoiceInputStatus = "idle" | "connecting" | "listening";

export function VoiceInputButton({
  disabled = false,
  onPartialTranscript,
  onTranscript,
  onError,
  onStatusChange,
  onAudioLevelChange,
}: {
  disabled?: boolean;
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
  const silenceWatchdogRef = useRef<ReturnType<typeof createVoiceSilenceWatchdog> | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    onStatusChange?.(listening ? "listening" : connecting ? "connecting" : "idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connecting, listening]);

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
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close();
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
    setConnecting(false);
    setListening(false);
    cleanupAudio();
    closeVoiceStream(true);
    onError?.(message);
  }, [cleanupAudio, closeVoiceStream, onError]);

  useEffect(() => () => {
    activeSessionRef.current = false;
    sessionRef.current += 1;
    cleanupAudio();
    closeVoiceStream(true);
  }, [cleanupAudio, closeVoiceStream]);

  const startStreaming = useCallback(async () => {
    if (activeSessionRef.current) return;
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    activeSessionRef.current = true;
    latestPartialTranscriptRef.current = "";
    reachedListeningRef.current = false;
    setConnecting(true);
    setListening(false);
    try {
      await waitForVoiceInputUiPaint();
      if (sessionRef.current !== session) return;
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
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") await audioContext.resume();
      if (sessionRef.current !== session) {
        mediaStream.getTracks().forEach((track) => track.stop());
        if (audioContext.state !== "closed") await audioContext.close();
        return;
      }
      let voiceStream: VoiceStream | null = null;
      const capture = await createVoiceAudioCapture({
        audioContext,
        pageOrigin: window.location.origin,
        onPcm: (audio) => {
          if (sessionRef.current !== session || !voiceStream) return;
          try {
            voiceStream.appendPcm(audio);
          } catch {
            finishWithError(t("Voice connection lost. Please try again."));
          }
        },
      });
      if (sessionRef.current !== session) {
        capture.node.disconnect();
        mediaStream.getTracks().forEach((track) => track.stop());
        if (audioContext.state !== "closed") await audioContext.close();
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
      voiceStream = await openVoiceStream({
        pageUrl: window.location.href,
        onReady: () => {
          if (sessionRef.current !== session || !voiceStream) return;
          voiceStreamRef.current = voiceStream;
          reachedListeningRef.current = true;
          const silenceWatchdog = createVoiceSilenceWatchdog({
            onTimeout: () => {
              if (sessionRef.current === session) endStreamingImmediately();
            },
          });
          silenceWatchdogRef.current = silenceWatchdog;
          silenceWatchdog.start();
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
          onTranscript(text);
          setConnecting(false);
          setListening(false);
          cleanupAudio();
          closeVoiceStream(false);
        },
        onError: (message) => finishWithError(message),
        onClosed: () => {
          if (sessionRef.current === session && activeSessionRef.current) finishWithError(t("Voice input disconnected."));
        },
      });
      if (sessionRef.current !== session) {
        voiceStream.cancel();
        voiceStream.close();
        return;
      }
      voiceStreamRef.current = voiceStream;
    } catch (reason) {
      finishWithError(microphoneErrorMessage(reason, t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupAudio, closeVoiceStream, finishWithError, onAudioLevelChange, onPartialTranscript, onTranscript, t]);

  // Manually stopping (button press or silence timeout) never waits for a proper `commit`/`final`
  // round trip — it takes whatever partial transcript has arrived so far and cancels immediately, for
  // a stop that feels instant. `commit()` on the stream exists for a slower, more deliberate "finalize
  // and wait for the confirmed transcript" flow, which this button doesn't use (matching the old
  // project's real `VoiceInputButton`, which never calls `.commit()` either).
  const endStreamingImmediately = useCallback(() => {
    if (!activeSessionRef.current) return;
    const partialTranscript = latestPartialTranscriptRef.current;
    const reachedListening = reachedListeningRef.current;
    activeSessionRef.current = false;
    latestPartialTranscriptRef.current = "";
    sessionRef.current += 1;
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
  }, [cleanupAudio, closeVoiceStream, onError, onTranscript, t]);

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
      className={`gm-mic-btn${active ? " listening" : ""}`}
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
