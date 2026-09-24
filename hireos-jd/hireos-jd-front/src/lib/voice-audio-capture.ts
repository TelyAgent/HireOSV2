/**
 * Ported verbatim (module system aside) from the old project's `lib/voice-audio-capture.mts`. Framework
 * agnostic — just browser AudioContext/AudioWorklet APIs — so nothing needed adapting for this project.
 */
export type VoiceAudioCaptureMode = "audio-worklet" | "script-processor";

export type VoiceAudioCapture = {
  mode: VoiceAudioCaptureMode;
  node: AudioNode;
};

type VoiceAudioCaptureOptions = {
  audioContext: AudioContext;
  pageOrigin: string;
  onPcm: (audio: ArrayBuffer) => void;
  createWorkletNode?: (context: AudioContext) => AudioWorkletNode;
};

class StreamingPcm16Resampler {
  private pending = new Float32Array(0);
  private position = 0;
  private output: number[] = [];
  private readonly targetSampleRate: number;
  private readonly frameSamples: number;

  constructor(targetSampleRate = 16_000, frameSamples = 1_600) {
    this.targetSampleRate = targetSampleRate;
    this.frameSamples = frameSamples;
  }

  push(input: Float32Array, sourceSampleRate: number): ArrayBuffer[] {
    if (input.length === 0) return [];
    if (!Number.isFinite(sourceSampleRate) || sourceSampleRate < this.targetSampleRate) {
      throw new Error("source sample rate must be at least the target sample rate");
    }
    const combined = new Float32Array(this.pending.length + input.length);
    combined.set(this.pending);
    combined.set(input, this.pending.length);
    this.pending = combined;
    const step = sourceSampleRate / this.targetSampleRate;
    const frames: ArrayBuffer[] = [];
    while (this.position + 1 < this.pending.length) {
      const left = Math.floor(this.position);
      const ratio = this.position - left;
      const sample = this.pending[left] * (1 - ratio) + this.pending[left + 1] * ratio;
      this.output.push(floatToPcm16(sample));
      this.position += step;
      if (this.output.length === this.frameSamples) frames.push(this.takeOutput());
    }
    const consumed = Math.floor(this.position);
    if (consumed > 0) {
      this.pending = this.pending.slice(consumed);
      this.position -= consumed;
    }
    return frames;
  }

  private takeOutput(): ArrayBuffer {
    const frame = Int16Array.from(this.output);
    this.output = [];
    return frame.buffer;
  }
}

function floatToPcm16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
}

export async function createVoiceAudioCapture(options: VoiceAudioCaptureOptions): Promise<VoiceAudioCapture> {
  const moduleUrl = new URL("/doubaoinput-pcm-worklet.mjs", options.pageOrigin).href;
  const createWorkletNode = options.createWorkletNode
    || ((context: AudioContext) => new AudioWorkletNode(context, "doubaoinput-pcm"));
  try {
    await options.audioContext.audioWorklet.addModule(moduleUrl);
    const node = createWorkletNode(options.audioContext);
    node.port.onmessage = (event: MessageEvent<{ type?: string; audio?: ArrayBuffer }>) => {
      if (event.data.type === "pcm" && event.data.audio) options.onPcm(event.data.audio);
    };
    return { mode: "audio-worklet", node };
  } catch {
    const resampler = new StreamingPcm16Resampler();
    const node = options.audioContext.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      for (const frame of resampler.push(input, options.audioContext.sampleRate)) {
        options.onPcm(frame);
      }
    };
    return { mode: "script-processor", node };
  }
}
