export class StreamingPcm16Resampler {
  constructor(targetSampleRate = 16000, frameSamples = 1600) {
    this.targetSampleRate = targetSampleRate;
    this.frameSamples = frameSamples;
    this.pending = new Float32Array(0);
    this.position = 0;
    this.output = [];
  }

  push(input, sourceSampleRate) {
    if (!(input instanceof Float32Array) || input.length === 0) return [];
    if (!Number.isFinite(sourceSampleRate) || sourceSampleRate < this.targetSampleRate) {
      throw new Error("source sample rate must be at least the target sample rate");
    }
    const combined = new Float32Array(this.pending.length + input.length);
    combined.set(this.pending);
    combined.set(input, this.pending.length);
    this.pending = combined;
    const step = sourceSampleRate / this.targetSampleRate;
    const frames = [];
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

  flush() {
    if (this.output.length === 0) return [];
    return [this.takeOutput()];
  }

  takeOutput() {
    const frame = Int16Array.from(this.output);
    this.output = [];
    return frame.buffer;
  }
}

function floatToPcm16(sample) {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
}

if (typeof globalThis.AudioWorkletProcessor === "function" && typeof globalThis.registerProcessor === "function") {
  class DoubaoInputPcmProcessor extends globalThis.AudioWorkletProcessor {
    constructor() {
      super();
      this.resampler = new StreamingPcm16Resampler(16000, 1600);
      this.port.onmessage = (event) => {
        if (event.data?.type !== "flush") return;
        for (const frame of this.resampler.flush()) this.port.postMessage({ type: "pcm", audio: frame }, [frame]);
        this.port.postMessage({ type: "flushed" });
      };
    }

    process(inputs) {
      const channel = inputs[0]?.[0];
      if (channel) {
        for (const frame of this.resampler.push(channel, globalThis.sampleRate)) {
          this.port.postMessage({ type: "pcm", audio: frame }, [frame]);
        }
      }
      return true;
    }
  }

  globalThis.registerProcessor("doubaoinput-pcm", DoubaoInputPcmProcessor);
}
