import {
  type CaptureStreams,
  type RecordingOptions,
  type RecordingResult,
  type RecordingTrack,
  type RecordingTrackName,
} from "@/lib/recording/types";

type RecorderKind = "video" | "audio";

type Sink = {
  write: (blob: Blob) => void;
  finish: () => Promise<Blob>;
  discard: () => Promise<void>;
  cleanup?: () => Promise<void>;
};

type Callbacks = {
  onTick?: (seconds: number) => void;
  onError?: (message: string) => void;
  onScreenEnded?: () => void;
};

const VIDEO_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

const AUDIO_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
];

function pickMimeType(kind: RecorderKind): string {
  const types = kind === "video" ? VIDEO_TYPES : AUDIO_TYPES;
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? types[types.length - 1];
}

async function memorySink(mimeType: string): Promise<Sink> {
  const chunks: Blob[] = [];
  return {
    write: (blob) => {
      if (blob.size > 0) chunks.push(blob);
    },
    finish: async () => new Blob(chunks, { type: mimeType }),
    discard: async () => {
      chunks.length = 0;
    },
  };
}

async function opfsSink(name: string, mimeType: string): Promise<Sink> {
  if (!navigator.storage?.getDirectory) return memorySink(mimeType);

  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    let queue = Promise.resolve();
    let failed: Error | null = null;

    return {
      write: (blob) => {
        if (blob.size === 0) return;
        queue = queue.then(async () => {
          try {
            await writable.write(blob);
          } catch (error) {
            failed =
              error instanceof Error ? error : new Error("Could not write recording to browser storage.");
          }
        });
      },
      finish: async () => {
        await queue;
        if (failed) throw failed;
        await writable.close();
        return handle.getFile();
      },
      discard: async () => {
        await queue;
        await writable.close().catch(() => undefined);
        await root.removeEntry(name).catch(() => undefined);
      },
      cleanup: async () => {
        await root.removeEntry(name).catch(() => undefined);
      },
    };
  } catch {
    return memorySink(mimeType);
  }
}

export class SessionRecorder {
  private options: RecordingOptions | null = null;
  private streams: CaptureStreams = { display: null, camera: null, microphone: null };
  private recorders = new Map<RecordingTrackName, MediaRecorder>();
  private sinks = new Map<RecordingTrackName, Sink>();
  private mimeTypes = new Map<RecordingTrackName, string>();
  private callbacks: Callbacks;
  private startedAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopping: Promise<RecordingResult> | null = null;
  private cancelled = false;

  constructor(callbacks: Callbacks = {}) {
    this.callbacks = callbacks;
  }

  getStreams(): CaptureStreams {
    return this.streams;
  }

  async prepare(options: RecordingOptions): Promise<CaptureStreams> {
    this.dispose();
    this.cancelled = false;
    this.options = options;

    const wantsScreen = options.source === "screen-camera" || options.source === "screen";
    const wantsCamera =
      options.source === "camera" ||
      (options.source === "screen-camera" && options.cameraMode !== "off");

    if (wantsScreen) {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: options.screenQuality === "1080p" ? 1920 : 1280 },
          height: { ideal: options.screenQuality === "1080p" ? 1080 : 720 },
          frameRate: { ideal: options.frameRate },
        },
        audio: options.systemAudio,
      });
      const videoTrack = display.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => this.callbacks.onScreenEnded?.(), { once: true });
      }
      this.streams.display = display;
    }

    if (wantsCamera) {
      const cameraWidth = options.cameraQuality === "1080p" ? 1920 : options.cameraQuality === "720p" ? 1280 : 854;
      const cameraHeight = options.cameraQuality === "1080p" ? 1080 : options.cameraQuality === "720p" ? 720 : 480;
      this.streams.camera = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: cameraWidth },
          height: { ideal: cameraHeight },
          frameRate: { ideal: options.frameRate },
          facingMode: "user",
        },
        audio: false,
      });
    }

    if (options.microphone) {
      this.streams.microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    }

    return this.streams;
  }

  async start(): Promise<void> {
    const options = this.options;
    if (!options) throw new Error("Recording has not been prepared.");
    if (this.recorders.size > 0) throw new Error("Recording is already running.");

    const display = this.streams.display;
    const camera = this.streams.camera;
    const microphone = this.streams.microphone;

    if (display) {
      const videoTracks = display.getVideoTracks();
      if (videoTracks.length > 0) {
        await this.recordTrack(
          "screen",
          new MediaStream(videoTracks),
          "video",
          options.screenQuality === "1080p" ? 4_000_000 : 2_500_000,
        );
      }
      const audioTracks = display.getAudioTracks();
      if (audioTracks.length > 0) {
        await this.recordTrack("system", new MediaStream(audioTracks), "audio", 128_000);
      }
    }

    if (camera) {
      const videoTracks = camera.getVideoTracks();
      if (videoTracks.length > 0) {
        await this.recordTrack(
          "camera",
          new MediaStream(videoTracks),
          "video",
          options.cameraQuality === "1080p" ? 3_000_000 : 1_500_000,
        );
      }
    }

    if (microphone) {
      const audioTracks = microphone.getAudioTracks();
      if (audioTracks.length > 0) {
        await this.recordTrack("microphone", new MediaStream(audioTracks), "audio", 128_000);
      }
    }

    if (this.recorders.size === 0) {
      throw new Error("No recording tracks were available.");
    }

    this.startedAt = performance.now();
    this.pausedAt = 0;
    this.pausedTotal = 0;
    this.recorders.forEach((recorder) => recorder.start(1000));
    this.timer = setInterval(() => this.callbacks.onTick?.(this.elapsedSeconds()), 250);
  }

  pause(): void {
    if (this.recorders.size === 0) return;
    this.recorders.forEach((recorder) => {
      if (recorder.state === "recording") recorder.pause();
    });
    this.pausedAt = performance.now();
  }

  resume(): void {
    if (this.recorders.size === 0) return;
    this.recorders.forEach((recorder) => {
      if (recorder.state === "paused") recorder.resume();
    });
    if (this.pausedAt > 0) {
      this.pausedTotal += performance.now() - this.pausedAt;
      this.pausedAt = 0;
    }
  }

  async stop(): Promise<RecordingResult> {
    if (this.stopping) return this.stopping;
    this.stopping = this.finish();
    return this.stopping;
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    this.clearTimer();
    this.recorders.forEach((recorder) => {
      if (recorder.state !== "inactive") recorder.stop();
    });
    this.recorders.clear();
    await Promise.all([...this.sinks.values()].map((sink) => sink.discard().catch(() => undefined)));
    this.sinks.clear();
    this.mimeTypes.clear();
    this.dispose();
  }

  private async recordTrack(
    name: RecordingTrackName,
    stream: MediaStream,
    kind: RecorderKind,
    bitrate: number,
  ): Promise<void> {
    const mimeType = pickMimeType(kind);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: kind === "video" ? bitrate : undefined,
      audioBitsPerSecond: kind === "audio" ? bitrate : undefined,
    });
    const sink = await opfsSink(`devlogue-${crypto.randomUUID()}-${name}`, mimeType);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) sink.write(event.data);
    };
    recorder.onerror = () => {
      this.callbacks.onError?.(`The ${name} recorder stopped unexpectedly.`);
    };

    this.recorders.set(name, recorder);
    this.sinks.set(name, sink);
    this.mimeTypes.set(name, mimeType);
  }

  private elapsedSeconds(): number {
    if (this.startedAt === 0) return 0;
    const pausedNow = this.pausedAt > 0 ? performance.now() - this.pausedAt : 0;
    return Math.max(0, (performance.now() - this.startedAt - this.pausedTotal - pausedNow) / 1000);
  }

  private async finish(): Promise<RecordingResult> {
    this.clearTimer();
    const durationSec = this.elapsedSeconds();

    if (this.recorders.size === 0) {
      this.dispose();
      return { durationSec, tracks: [] };
    }

    await Promise.all(
      [...this.recorders.entries()].map(
        ([name, recorder]) =>
          new Promise<void>((resolve) => {
            if (recorder.state === "inactive") {
              resolve();
              return;
            }
            recorder.addEventListener("stop", () => resolve(), { once: true });
            recorder.stop();
          }),
      ),
    );

    const tracks: RecordingTrack[] = [];
    for (const [name, sink] of this.sinks) {
      const blob = await sink.finish();
      if (blob.size > 0) {
        tracks.push({
          name,
          blob,
          mimeType: this.mimeTypes.get(name) || blob.type || "application/octet-stream",
          cleanup: sink.cleanup,
        });
      }
    }

    this.recorders.clear();
    this.sinks.clear();
    this.mimeTypes.clear();
    this.dispose();
    return { durationSec, tracks };
  }

  private clearTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private dispose(): void {
    this.clearTimer();
    [this.streams.display, this.streams.camera, this.streams.microphone].forEach((stream) => {
      stream?.getTracks().forEach((track) => track.stop());
    });
    this.streams = { display: null, camera: null, microphone: null };
    if (!this.cancelled) this.stopping = null;
  }
}
