"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  completeUpload,
  requestUpload,
} from "@/app/actions/media";
import { uploadMultipart } from "@/lib/upload/multipart";
import { createRecording } from "@/app/actions/recordings";
import { SessionRecorder } from "@/lib/recording/media-recorder";
import { startPreviewLoop } from "@/lib/recording/compositor";
import {
  CAMERA_MODES,
  CAMERA_POSITIONS,
  CAMERA_SIZES,
  DEFAULT_RECORDING_OPTIONS,
  RECORDING_ASPECTS,
  RECORDING_SOURCES,
  RECORDING_TRACK_LABELS,
  formatBytes,
  formatDuration,
  type CameraMode,
  type CameraPosition,
  type CameraSize,
  type CaptureStreams,
  type RecordingAspect,
  type RecordingOptions,
  type RecordingResult,
  type RecordingSource,
} from "@/lib/recording/types";
import {
  buttonPrimary,
  buttonSecondary,
  hintClass,
  inputClass,
  labelClass,
} from "@/components/ui";

type Status =
  | "idle"
  | "requesting"
  | "countdown"
  | "recording"
  | "paused"
  | "processing"
  | "complete"
  | "error";

type Download = {
  name: string;
  label: string;
  url: string;
  size: number;
};

type SessionOption = {
  id: string;
  title: string;
  projectName: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "bin";
}

function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onerror = () => reject(new Error("Upload failed. Check the R2 CORS policy for this origin."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`R2 upload failed (${request.status}).`));
    };
    request.send(blob);
  });
}

const SOURCE_LABELS: Record<RecordingSource, string> = {
  "screen-camera": "Screen + camera",
  screen: "Screen only",
  camera: "Camera only",
};

const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  off: "Off",
  record: "Record only",
  pip: "Show PiP",
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function subscribeSupport(): () => void {
  return () => undefined;
}

function getSupportSnapshot(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}

function getSupportServerSnapshot(): boolean {
  return false;
}

export function RecorderClient({
  sessions,
  initialSessionId,
}: {
  sessions: SessionOption[];
  initialSessionId?: string;
}) {
  const [options, setOptions] = useState<RecordingOptions>(DEFAULT_RECORDING_OPTIONS);
  const [status, setStatus] = useState<Status>("idle");
  const [streams, setStreams] = useState<CaptureStreams | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [duration, setDuration] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(() => {
    if (initialSessionId && sessions.some((session) => session.id === initialSessionId)) {
      return initialSessionId;
    }
    return sessions[0]?.id ?? "";
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState(0);
  const [savedTimelineId, setSavedTimelineId] = useState<string | null>(null);
  const supported = useSyncExternalStore(
    subscribeSupport,
    getSupportSnapshot,
    getSupportServerSnapshot,
  );

  const recorderRef = useRef<SessionRecorder | null>(null);
  const runRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const optionsRef = useRef(options);
  const downloadsRef = useRef<Download[]>([]);
  const resultRef = useRef<RecordingResult | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!canvasRef.current) return;
    return startPreviewLoop(
      canvasRef.current,
      () => ({ screen: screenVideoRef.current, camera: cameraVideoRef.current }),
      () => optionsRef.current,
    );
  }, []);

  useEffect(() => {
    const screen = screenVideoRef.current;
    const camera = cameraVideoRef.current;
    if (screen) screen.srcObject = streams?.display ?? null;
    if (camera) camera.srcObject = streams?.camera ?? null;
    [screen, camera].forEach((video) => {
      if (video?.srcObject instanceof MediaStream) {
        void video.play().catch(() => undefined);
      }
    });
  }, [streams]);

  useEffect(() => {
    return () => {
      void recorderRef.current?.cancel();
      downloadsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
      resultRef.current?.tracks.forEach((track) => void track.cleanup?.());
    };
  }, []);

  const busy = ["requesting", "countdown", "recording", "paused", "processing"].includes(status);
  const screenCamera = options.source === "screen-camera";
  const needsScreen = options.source !== "camera";
  const needsCamera = options.source === "camera" || (screenCamera && options.cameraMode !== "off");
  const controlsDisabled = busy;
  const selectedSession = sessions.find((session) => session.id === sessionId) ?? null;

  function update<K extends keyof RecordingOptions>(key: K, value: RecordingOptions[K]): void {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function replaceDownloads(next: Download[]): void {
    downloadsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    downloadsRef.current = next;
    setDownloads(next);
  }

  function resetSaveState(): void {
    setSaveStatus("idle");
    setSaveError(null);
    setSaveProgress(0);
    setSavedTimelineId(null);
  }

  function discardResult(): void {
    const current = resultRef.current;
    resultRef.current = null;
    setResult(null);
    current?.tracks.forEach((track) => void track.cleanup?.());
  }

  async function saveToSession(): Promise<void> {
    if (!result) return;
    if (!sessionId) {
      setSaveError("Choose a build session first.");
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);
    setSaveProgress(0);
    setSavedTimelineId(null);
    try {
      const total = result.tracks.length;
      const uploaded: { assetId: string; track: RecordingResult["tracks"][number]["name"] }[] = [];
      for (let index = 0; index < total; index += 1) {
        const track = result.tracks[index];
        const contentType = track.mimeType.split(";")[0]?.trim() || "application/octet-stream";
        const filename = `${track.name}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extensionForMime(track.mimeType)}`;
        const ticket = await requestUpload({
          sessionId,
          filename,
          contentType,
          sizeBytes: track.blob.size,
        });
        if (!ticket.ok) throw new Error(ticket.error);
        let completed;
        if (ticket.mode === "single") {
          await putWithProgress(ticket.uploadUrl, track.blob, contentType, (fraction) => {
            setSaveProgress((index + fraction) / total);
          });
          completed = await completeUpload({
            sessionId,
            key: ticket.key,
            filename: ticket.filename,
            contentType,
            sizeBytes: track.blob.size,
          });
        } else {
          try {
            await uploadMultipart(track.blob, ticket, {
              onProgress: (fraction) => {
                setSaveProgress((index + fraction) / total);
              },
            });
            completed = await completeMultipartUpload({
              uploadId: ticket.uploadId,
              sessionId,
              key: ticket.key,
              filename: ticket.filename,
              contentType,
              sizeBytes: track.blob.size,
            });
          } catch (uploadError) {
            await abortMultipartUpload({ uploadId: ticket.uploadId, sessionId }).catch(
              () => undefined,
            );
            throw uploadError;
          }
        }
        if (!completed.ok) {
          throw new Error(completed.error ?? `Could not save the ${track.name} track.`);
        }
        uploaded.push({ assetId: completed.assetId, track: track.name });
      }

      const created = await createRecording({
        sessionId,
        durationSec: result.durationSec,
        source: options.source,
        aspectRatio: options.aspect,
        fps: options.frameRate,
        cameraVisible: options.cameraMode === "pip",
        cameraPosition: options.cameraPosition,
        cameraSize: options.cameraSize,
        mirrorCamera: options.mirrorCamera,
        tracks: uploaded,
      });
      if (!created.ok) throw new Error(created.error);
      setSavedTimelineId(created.timelineId);
      setSaveProgress(1);
      setSaveStatus("saved");
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "Could not save the recording.");
      setSaveStatus("error");
    }
  }

  async function startRecording(): Promise<void> {
    if (!supported) return;
    const run = runRef.current + 1;
    runRef.current = run;
    setError(null);
    replaceDownloads([]);
    discardResult();
    resetSaveState();
    setDuration(0);
    setStatus("requesting");

    const recorder = new SessionRecorder({
      onTick: (seconds) => setDuration(seconds),
      onError: (message) => {
        setError(message);
        setStatus("error");
      },
      onScreenEnded: () => {
        void stopRecording();
      },
    });
    recorderRef.current = recorder;

    try {
      const nextStreams = await recorder.prepare(options);
      if (runRef.current !== run) {
        await recorder.cancel();
        return;
      }
      setStreams(nextStreams);
      setStatus("countdown");
      for (let value = 3; value > 0; value -= 1) {
        setCountdown(value);
        await delay(1000);
        if (runRef.current !== run) return;
      }
      setCountdown(0);
      await recorder.start();
      if (runRef.current !== run) {
        await recorder.cancel();
        return;
      }
      setStatus("recording");
    } catch (startError) {
      await recorder.cancel().catch(() => undefined);
      setStreams(null);
      setError(startError instanceof Error ? startError.message : "Could not start recording.");
      setStatus("error");
    }
  }

  async function stopRecording(): Promise<void> {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setStatus("processing");
    try {
      const next = await recorder.stop();
      const items = next.tracks.map((track) => ({
        name: track.name,
        label: RECORDING_TRACK_LABELS[track.name],
        url: URL.createObjectURL(track.blob),
        size: track.blob.size,
      }));
      replaceDownloads(items);
      resultRef.current = next;
      setResult(next);
      setDuration(next.durationSec);
      setStreams(null);
      setStatus("complete");
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Could not finish the recording.");
      setStatus("error");
    } finally {
      recorderRef.current = null;
    }
  }

  async function cancelRecording(): Promise<void> {
    runRef.current += 1;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    await recorder?.cancel().catch(() => undefined);
    setStreams(null);
    setStatus("idle");
    setCountdown(0);
    setDuration(0);
    setError(null);
    replaceDownloads([]);
    discardResult();
    resetSaveState();
  }

  function reset(): void {
    replaceDownloads([]);
    discardResult();
    resetSaveState();
    setDuration(0);
    setStatus("idle");
    setError(null);
  }

  function togglePause(): void {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (status === "recording") {
      recorder.pause();
      setStatus("paused");
    } else if (status === "paused") {
      recorder.resume();
      setStatus("recording");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
          <div className="relative flex min-h-[260px] items-center justify-center bg-slate-950">
            <canvas
              ref={canvasRef}
              className="max-h-[62vh] w-full object-contain"
              aria-label="Recording preview"
            />
            {status === "countdown" && countdown > 0 ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/55">
                <span className="text-7xl font-semibold text-white">{countdown}</span>
              </div>
            ) : null}
            {status === "requesting" ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/70 text-sm text-white">
                Waiting for browser permission...
              </div>
            ) : null}
            {!streams && status !== "requesting" && status !== "complete" ? (
              <div className="absolute inset-x-6 bottom-6 rounded-lg bg-slate-900/85 px-4 py-3 text-sm text-slate-200">
                Choose a capture mode, then start. Your screen and camera are recorded as separate
                tracks so the camera can be shown or hidden later.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status === "recording"
                    ? "animate-pulse bg-rose-500"
                    : status === "paused"
                      ? "bg-amber-400"
                      : "bg-slate-500"
                }`}
              />
              <span className="font-mono text-base">{formatDuration(duration)}</span>
              <span className="text-slate-400">
                {status === "recording"
                  ? "Recording"
                  : status === "paused"
                    ? "Paused"
                    : status === "processing"
                      ? "Preparing tracks"
                      : status === "complete"
                        ? "Recording complete"
                        : "Ready"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status === "recording" || status === "paused" ? (
                <>
                  <button type="button" className={buttonSecondary} onClick={togglePause}>
                    {status === "paused" ? "Resume" : "Pause"}
                  </button>
                  <button type="button" className={buttonPrimary} onClick={() => void stopRecording()}>
                    Stop recording
                  </button>
                </>
              ) : null}
              {status === "countdown" || status === "requesting" ? (
                <button type="button" className={buttonSecondary} onClick={() => void cancelRecording()}>
                  Cancel
                </button>
              ) : null}
              {status === "complete" ? (
                <button type="button" className={buttonSecondary} onClick={reset}>
                  Record another
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <video ref={screenVideoRef} muted playsInline className="pointer-events-none absolute h-px w-px opacity-0" />
        <video ref={cameraVideoRef} muted playsInline className="pointer-events-none absolute h-px w-px opacity-0" />

        {error ? (
          <div role="status" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        {supported === false ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Screen recording needs a Chromium-based desktop browser. Camera-only recording may still
            work in your browser.
          </div>
        ) : null}

        {result ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Recording ready</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {formatDuration(result.durationSec)} captured across {result.tracks.length} track
                  {result.tracks.length === 1 ? "" : "s"}.
                </p>
              </div>
              <span className="text-xs text-slate-500">
                {formatBytes(result.tracks.reduce((sum, track) => sum + track.blob.size, 0))}
              </span>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <span className={labelClass}>Destination</span>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedSession
                      ? `${selectedSession.projectName} - ${selectedSession.title}`
                      : "No session selected"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Saving uploads the raw tracks and opens this session in the video editor.
                  </p>
                </div>
                <button
                  type="button"
                  className={buttonPrimary}
                  disabled={!sessionId || saveStatus === "saving" || saveStatus === "saved"}
                  onClick={() => void saveToSession()}
                >
                  {saveStatus === "saving"
                    ? `Saving ${Math.round(saveProgress * 100)}%`
                    : saveStatus === "saved"
                      ? "Saved"
                      : "Save recording"}
                </button>
              </div>
              {sessions.length === 0 ? (
                <p className={hintClass}>
                  <Link className="font-medium text-indigo-700" href="/sessions/new">
                    Create a build session
                  </Link>{" "}
                  before saving tracks.
                </p>
              ) : null}
              {saveStatus === "saving" ? (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all"
                    style={{ width: `${Math.round(saveProgress * 100)}%` }}
                  />
                </div>
              ) : null}
              {saveError ? <p className="mt-2 text-sm text-rose-700">{saveError}</p> : null}
              {saveStatus === "saved" ? (
                <p className="mt-2 text-sm text-emerald-700">
                  Saved to the session.{" "}
                  {savedTimelineId ? (
                    <Link
                      className="font-medium text-emerald-800 underline"
                      href={`/timelines/${savedTimelineId}`}
                    >
                      Open timeline
                    </Link>
                  ) : (
                    <Link className="font-medium text-emerald-800 underline" href={`/sessions/${sessionId}`}>
                      Open session
                    </Link>
                  )}
                </p>
              ) : null}
            </div>
            <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
              {downloads.map((download) => (
                <li key={download.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{download.label}</p>
                    <p className="text-xs text-slate-500">{formatBytes(download.size)}</p>
                  </div>
                  <a className="text-sm font-medium text-indigo-700 hover:text-indigo-900" href={download.url} download={`${download.name}.webm`}>
                    Download
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Saving creates a multi-track timeline. Camera visibility, positioning and 16:9/9:16
              framing stay editable; transcription and server-side final render come next.
            </p>
          </div>
        ) : null}
      </div>

      <aside className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Capture</h2>
          <div className="mt-3 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="record-session-destination" className={labelClass}>
                  Editing studio destination
                </label>
                <Link
                  className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                  href="/sessions/new"
                >
                  New session
                </Link>
              </div>
              <select
                id="record-session-destination"
                className={`${inputClass} mt-1`}
                value={sessionId}
                disabled={
                  controlsDisabled || saveStatus === "saving" || saveStatus === "saved"
                }
                onChange={(event) => setSessionId(event.target.value)}
              >
                {sessions.length === 0 ? <option value="">No sessions yet</option> : null}
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.projectName} - {session.title}
                  </option>
                ))}
              </select>
              {sessions.length === 0 ? (
                <p className={hintClass}>
                  Create a build session, then choose it here before recording.
                </p>
              ) : (
                <p className={hintClass}>
                  Saving creates a timeline in this session and opens the video editor.
                </p>
              )}
            </div>

            <div>
              <span className={labelClass}>Source</span>
              <div className="mt-2 grid gap-2">
                {RECORDING_SOURCES.map((source) => (
                  <button
                    key={source}
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => {
                      update("source", source);
                      if (source === "screen") update("cameraMode", "off");
                      if (source === "camera") update("cameraMode", "pip");
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      options.source === source
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {SOURCE_LABELS[source]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={labelClass}>Format</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {RECORDING_ASPECTS.map((aspect) => (
                  <button
                    key={aspect}
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => update("aspect", aspect as RecordingAspect)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      options.aspect === aspect
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {aspect}
                  </button>
                ))}
              </div>
            </div>

            {screenCamera ? (
              <div>
                <span className={labelClass}>Camera</span>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {CAMERA_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => update("cameraMode", mode as CameraMode)}
                      className={`rounded-lg border px-2 py-2 text-xs ${
                        options.cameraMode === mode
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {CAMERA_MODE_LABELS[mode]}
                    </button>
                  ))}
                </div>
                <p className={hintClass}>
                  Record only keeps the camera out of the video but available in the timeline.
                </p>
              </div>
            ) : null}

            {screenCamera && options.cameraMode === "pip" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Position</span>
                  <select
                    className={`${inputClass} mt-1`}
                    value={options.cameraPosition}
                    disabled={controlsDisabled}
                    onChange={(event) => update("cameraPosition", event.target.value as CameraPosition)}
                  >
                    {CAMERA_POSITIONS.map((position) => (
                      <option key={position} value={position}>
                        {position.replace("-", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Size</span>
                  <select
                    className={`${inputClass} mt-1`}
                    value={options.cameraSize}
                    disabled={controlsDisabled}
                    onChange={(event) => update("cameraSize", event.target.value as CameraSize)}
                  >
                    {CAMERA_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {screenCamera && options.cameraMode === "pip" ? (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={options.mirrorCamera}
                  disabled={controlsDisabled}
                  onChange={(event) => update("mirrorCamera", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Mirror camera
              </label>
            ) : null}

            <div>
              <span className={labelClass}>Audio</span>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={options.microphone}
                    disabled={controlsDisabled}
                    onChange={(event) => update("microphone", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Microphone
                </label>
                {needsScreen ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={options.systemAudio}
                      disabled={controlsDisabled}
                      onChange={(event) => update("systemAudio", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    System audio
                  </label>
                ) : null}
              </div>
              {needsScreen ? (
                <p className={hintClass}>System audio is available in Chrome and Edge.</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Frame rate</span>
                <select
                  className={`${inputClass} mt-1`}
                  value={options.frameRate}
                  disabled={controlsDisabled}
                  onChange={(event) => update("frameRate", Number(event.target.value) as 30 | 60)}
                >
                  <option value={30}>30 fps</option>
                  <option value={60}>60 fps</option>
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Screen</span>
                <select
                  className={`${inputClass} mt-1`}
                  value={options.screenQuality}
                  disabled={controlsDisabled || !needsScreen}
                  onChange={(event) => update("screenQuality", event.target.value as "720p" | "1080p")}
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
            </div>

            {needsCamera ? (
              <label className="block">
                <span className={labelClass}>Camera quality</span>
                <select
                  className={`${inputClass} mt-1`}
                  value={options.cameraQuality}
                  disabled={controlsDisabled}
                  onChange={(event) =>
                    update("cameraQuality", event.target.value as "480p" | "720p" | "1080p")
                  }
                >
                  <option value="480p">480p</option>
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
            ) : null}

            <button
              type="button"
              className={`${buttonPrimary} w-full`}
              disabled={!supported || busy}
              onClick={() => void startRecording()}
            >
              {status === "requesting"
                ? "Preparing..."
                : status === "countdown"
                  ? "Starting..."
                  : "Start recording"}
            </button>
            <p className={hintClass}>
              Screen and camera are saved as separate raw tracks. The final composited MP4 is rendered
              on the server.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
