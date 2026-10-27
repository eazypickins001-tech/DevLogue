"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  generateTimelineCaptions,
  queueTimelineRender,
  queueTimelineTranscription,
  saveTimeline,
} from "@/app/actions/recordings";
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  hintClass,
  inputClass,
  labelClass,
} from "@/components/ui";
import { cameraRect, formatDuration, outputSize, type RecordingAspect } from "@/lib/recording/types";
import {
  normalizeTimeline,
  type TimelineClip,
  type TimelineDocument,
  type TimelineText,
  type TimelineTrack,
} from "@/lib/timeline/model";

type EditorAsset = {
  id: string;
  filename: string;
  kind: string;
  contentType: string;
  url: string;
  thumbnailUrl: string | null;
  waveformUrl: string | null;
};

type TranscriptionState = {
  hasAudio: boolean;
  hasTranscript: boolean;
  segmentCount: number;
  jobStatus: string | null;
  jobError: string | null;
};

type Props = {
  timelineId: string;
  title: string;
  version: number;
  initialDocument: TimelineDocument;
  assets: EditorAsset[];
  transcription: TranscriptionState;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function clipIsActive(clip: TimelineClip, time: number): boolean {
  return time >= clip.startSec && time < clip.startSec + clip.durationSec;
}

function clipTarget(clip: TimelineClip, time: number): number {
  return Math.max(0, clip.sourceInSec + Math.max(0, time - clip.startSec));
}

function defaultText(): TimelineText {
  return {
    content: "New caption",
    fontSize: 48,
    color: "#ffffff",
    background: "rgba(15,23,42,0.65)",
    align: "center",
    position: "bottom",
  };
}

export function TimelineEditor({
  timelineId,
  title,
  version,
  initialDocument,
  assets,
  transcription,
}: Props) {
  const [document, setDocument] = useState<TimelineDocument>(() =>
    structuredClone(initialDocument),
  );
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(version);
  const [dirty, setDirty] = useState(false);
  const timeRef = useRef(0);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const duration = Math.max(0.1, document.durationSec);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.12, Math.max(0, (now - last) / 1000));
      last = now;
      const next = Math.min(duration, timeRef.current + delta);
      timeRef.current = next;
      setTime(next);
      if (next >= duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);

  useEffect(() => {
    document.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.kind === "audio") {
          const element = audioRefs.current.get(clip.id);
          if (!element) return;
          if (track.hidden || !clipIsActive(clip, time)) {
            if (!element.paused) element.pause();
            return;
          }
          const target = clipTarget(clip, time);
          if (element.readyState >= 1 && Math.abs(element.currentTime - target) > 0.3) {
            element.currentTime = target;
          }
          element.volume = clip.muted ? 0 : Math.min(1, Math.max(0, clip.volume));
          if (playing && element.paused) void element.play().catch(() => undefined);
          if (!playing && !element.paused) element.pause();
          return;
        }

        const element = videoRefs.current.get(clip.id);
        if (!element) return;
        if (track.hidden || !clipIsActive(clip, time)) {
          if (!element.paused) element.pause();
          return;
        }
        const target = clipTarget(clip, time);
        if (element.readyState >= 1 && Math.abs(element.currentTime - target) > 0.3) {
          element.currentTime = target;
        }
        element.muted = true;
        if (playing && element.paused) void element.play().catch(() => undefined);
        if (!playing && !element.paused) element.pause();
      });
    });
  }, [document, playing, time]);

  const activeClips = document.tracks.flatMap((track) =>
    track.hidden
      ? []
      : track.clips
          .filter((clip) => clipIsActive(clip, time) && clip.kind !== "audio")
          .map((clip) => ({ track, clip })),
  );
  const allClips = document.tracks.flatMap((track) =>
    track.clips.map((clip) => ({ track, clip })),
  );
  const selected = allClips.find(({ clip }) => clip.id === selectedClipId) ?? null;
  const failedAsset = previewError
    ? [...assetMap.values()].find((asset) => asset.filename === previewError) ?? null
    : null;

  function seek(next: number): void {
    const clamped = Math.min(duration, Math.max(0, next));
    timeRef.current = clamped;
    setTime(clamped);
  }

  function updateDocument(updater: (current: TimelineDocument) => TimelineDocument): void {
    setDocument((current) => normalizeTimeline(updater(structuredClone(current))));
    setDirty(true);
    setSaveState("idle");
    setSaveError(null);
  }

  function updateClip(clipId: string, patch: Partial<TimelineClip>): void {
    updateDocument((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)),
      })),
    }));
  }

  function updateText(clipId: string, patch: Partial<TimelineText>): void {
    const existing = allClips.find(({ clip }) => clip.id === clipId)?.clip.text;
    if (!existing) return;
    updateClip(clipId, { text: { ...existing, ...patch } });
  }

  function toggleTrack(trackId: string): void {
    updateDocument((current) => ({
      ...current,
      tracks: current.tracks.map((track) =>
        track.id === trackId ? { ...track, hidden: !track.hidden } : track,
      ),
    }));
  }

  function deleteClip(clipId: string): void {
    updateDocument((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId),
      })),
    }));
    setSelectedClipId(null);
  }

  function addTextClip(): void {
    const textTrack =
      document.tracks.find((track) => track.kind === "text") ??
      ({
        id: `track-text-${crypto.randomUUID()}`,
        kind: "text",
        name: "Text",
        muted: false,
        hidden: false,
        clips: [],
      } satisfies TimelineTrack);
    const clip: TimelineClip = {
      id: `clip-${crypto.randomUUID()}`,
      trackId: textTrack.id,
      kind: "text",
      assetId: null,
      label: "Caption",
      startSec: Math.min(time, Math.max(0, duration - 1)),
      durationSec: Math.min(5, Math.max(1, duration - time)),
      sourceInSec: 0,
      sourceOutSec: null,
      volume: 1,
      muted: false,
      transform: null,
      text: defaultText(),
      transitionIn: "none",
      transitionOut: "none",
    };
    updateDocument((current) => {
      const exists = current.tracks.some((track) => track.id === textTrack.id);
      return {
        ...current,
        tracks: exists
          ? current.tracks.map((track) =>
              track.id === textTrack.id ? { ...track, clips: [...track.clips, clip] } : track,
            )
          : [...current.tracks, { ...textTrack, clips: [clip] }],
      };
    });
    setSelectedClipId(clip.id);
  }

  function setAspect(aspect: RecordingAspect): void {
    if (aspect === document.aspectRatio) return;
    const size = outputSize(aspect);
    updateDocument((current) => ({
      ...current,
      aspectRatio: aspect,
      width: size.width,
      height: size.height,
      tracks: current.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.kind === "overlay" && clip.transform
            ? {
                ...clip,
                transform: {
                  ...cameraRect(aspect, "bottom-right", "md"),
                  opacity: clip.transform.opacity,
                  cornerRadius: clip.transform.cornerRadius,
                  mirror: clip.transform.mirror,
                },
              }
            : clip,
        ),
      })),
    }));
  }

  async function save(): Promise<void> {
    setSaveState("saving");
    setSaveError(null);
    try {
      const result = await saveTimeline({ timelineId, document });
      if (!result.ok) throw new Error(result.error);
      setSavedVersion(result.version);
      setDirty(false);
      setSaveState("saved");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the timeline.");
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
            <div className="flex items-center justify-center p-3">
              <div
                className="relative mx-auto w-full max-w-full overflow-hidden bg-black"
                style={{
                  aspectRatio: document.aspectRatio === "16:9" ? "16 / 9" : "9 / 16",
                  maxHeight: "58vh",
                  maxWidth: document.aspectRatio === "9:16" ? "min(100%, 360px)" : "100%",
                }}
              >
                {document.tracks.flatMap((track) =>
                  track.clips
                    .filter((clip) => clip.kind === "video" || clip.kind === "overlay")
                    .map((clip) => {
                      const asset = clip.assetId ? assetMap.get(clip.assetId) : null;
                      if (!asset) return null;
                      const active = !track.hidden && clipIsActive(clip, time);
                      const overlay = clip.kind === "overlay" && clip.transform;
                      const style: CSSProperties = overlay
                        ? {
                            left: `${clip.transform!.x * 100}%`,
                            top: `${clip.transform!.y * 100}%`,
                            width: `${clip.transform!.width * 100}%`,
                            height: `${clip.transform!.height * 100}%`,
                            transform: clip.transform!.mirror ? "scaleX(-1)" : undefined,
                            opacity: clip.transform!.opacity,
                            visibility: active ? "visible" : "hidden",
                          }
                        : {
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            visibility: active ? "visible" : "hidden",
                          };
                      return (
                        <video
                          key={clip.id}
                          ref={(element) => {
                            if (element) videoRefs.current.set(clip.id, element);
                            else videoRefs.current.delete(clip.id);
                          }}
                          src={asset.url}
                          poster={asset.thumbnailUrl ?? undefined}
                          muted
                          playsInline
                          preload="auto"
                          onError={() => {
                            if (active) setPreviewError(asset.filename);
                          }}
                          onLoadedData={() => setPreviewError(null)}
                          onLoadedMetadata={(event) => {
                            const target = clipTarget(clip, timeRef.current);
                            if (Number.isFinite(target)) event.currentTarget.currentTime = target;
                          }}
                          className={
                            overlay
                              ? "absolute rounded-2xl border-2 border-white/80 object-cover shadow-lg"
                              : "absolute"
                          }
                          style={style}
                        />
                      );
                    }),
                )}
                {activeClips
                  .filter(({ clip }) => clip.kind === "text" && clip.text)
                  .map(({ clip }) => {
                    const text = clip.text!;
                    const position =
                      text.position === "top"
                        ? "items-start"
                        : text.position === "center"
                          ? "items-center"
                          : "items-end";
                    return (
                      <div
                        key={clip.id}
                        className={`pointer-events-none absolute inset-0 flex justify-center p-[4%] ${position}`}
                      >
                        <div
                          style={{
                            color: text.color,
                            background: text.background ?? "transparent",
                            fontSize: `${(text.fontSize / document.width) * 100}vw`,
                            textAlign: text.align,
                          }}
                          className="max-w-[92%] rounded-lg px-3 py-2 font-semibold leading-tight shadow-lg"
                        >
                          {text.content}
                        </div>
                      </div>
                    );
                  })}
                {activeClips.length === 0 ? (
                  <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">
                    No visible clip at this time.
                  </div>
                ) : null}
                {previewError ? (
                  <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/85 p-4 text-center">
                    <div className="max-w-sm space-y-2">
                      <p className="text-sm font-semibold text-white">Preview unavailable</p>
                      <p className="text-xs text-slate-300">{previewError}</p>
                      {failedAsset ? (
                        <a
                          className="inline-block text-xs font-medium text-indigo-300 hover:text-indigo-200"
                          href={failedAsset.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source media
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {!playing ? (
                  <button
                    type="button"
                    aria-label="Play timeline preview"
                    className="absolute inset-0 z-20 grid place-items-center bg-slate-950/20 transition hover:bg-slate-950/35"
                    onClick={() => {
                      if (time >= duration) seek(0);
                      setPlaying(true);
                    }}
                  >
                    <span className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg">
                      Play preview
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={buttonPrimary}
                onClick={() => {
                  if (time >= duration) seek(0);
                  setPlaying((current) => !current);
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <span className="font-mono text-sm text-slate-700">
                {formatDuration(time)} / {formatDuration(duration)}
              </span>
              <span className="text-xs text-slate-500">
                {activeClips[0]
                  ? `${activeClips[0].track.name}: ${activeClips[0].clip.label}`
                  : "No active clip"}
              </span>
              <input
                aria-label="Playhead"
                type="range"
                min={0}
                max={duration}
                step={0.01}
                value={time}
                onChange={(event) => seek(Number(event.target.value))}
                className="min-w-[180px] flex-1 accent-slate-900"
              />
              <div className="flex items-center gap-2">
                {(["16:9", "9:16"] as const).map((aspect) => (
                  <button
                    key={aspect}
                    type="button"
                    className={document.aspectRatio === aspect ? buttonPrimary : buttonSecondary}
                    onClick={() => setAspect(aspect)}
                  >
                    {aspect}
                  </button>
                ))}
              </div>
              <button type="button" className={buttonSecondary} onClick={addTextClip}>
                Add caption
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
                <p className={hintClass}>Click a clip to inspect it. Click the lane to move the playhead.</p>
              </div>
              <div className="flex items-center gap-2">
                {dirty ? <span className="text-xs text-amber-700">Unsaved changes</span> : null}
                <button
                  type="button"
                  className={buttonPrimary}
                  disabled={saveState === "saving"}
                  onClick={() => void save()}
                >
                  {saveState === "saving" ? "Saving..." : "Save timeline"}
                </button>
                <form action={queueTimelineRender}>
                  <input type="hidden" name="timelineId" value={timelineId} />
                  <button
                    type="submit"
                    className={buttonSecondary}
                    disabled={dirty || saveState === "saving"}
                  >
                    Queue final render
                  </button>
                </form>
              </div>
            </div>
            {saveError ? <p className="mt-2 text-sm text-rose-700">{saveError}</p> : null}
            {saveState === "saved" ? (
              <p className="mt-2 text-sm text-emerald-700">Saved as version {savedVersion}.</p>
            ) : null}
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[620px] space-y-2">
                {document.tracks.map((track) => (
                  <div key={track.id} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                    <div className="flex flex-col justify-center">
                      <span className="truncate text-xs font-medium text-slate-700">{track.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">{track.kind}</span>
                      {track.kind === "overlay" ? (
                        <button
                          type="button"
                          onClick={() => toggleTrack(track.id)}
                          className="mt-0.5 text-left text-[10px] text-indigo-700 hover:underline"
                        >
                          {track.hidden ? "Show camera" : "Hide camera"}
                        </button>
                      ) : null}
                    </div>
                    <div
                      className="relative h-12 rounded-lg border border-slate-200 bg-slate-100"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        seek(((event.clientX - rect.left) / rect.width) * duration);
                      }}
                    >
                      {track.clips.map((clip) => {
                        const asset = clip.assetId ? assetMap.get(clip.assetId) : null;
                        const mediaBackground =
                          track.kind === "audio" ? asset?.waveformUrl : asset?.thumbnailUrl;
                        const backgroundImage = mediaBackground
                          ? track.kind === "audio"
                            ? `url("${mediaBackground}")`
                            : `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.55)), url("${mediaBackground}")`
                          : undefined;
                        return (
                          <button
                            key={clip.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedClipId(clip.id);
                              seek(clip.startSec);
                            }}
                            className={`absolute top-1.5 h-9 overflow-hidden rounded-md px-2 text-left text-[11px] font-medium text-white shadow-sm ${
                              selectedClipId === clip.id
                                ? "bg-indigo-700 ring-2 ring-indigo-300"
                                : track.kind === "audio"
                                  ? "bg-emerald-700"
                                  : track.kind === "text"
                                    ? "bg-amber-600"
                                    : "bg-slate-700"
                            }`}
                            style={{
                              left: `${(clip.startSec / duration) * 100}%`,
                              width: `${(Math.min(clip.durationSec, duration - clip.startSec) / duration) * 100}%`,
                              backgroundImage,
                              backgroundSize: track.kind === "audio" ? "100% 100%" : "cover",
                              backgroundPosition: "center",
                            }}
                          >
                            <span className="relative z-10 drop-shadow-sm">{clip.label}</span>
                          </button>
                        );
                      })}
                      <div
                        className="pointer-events-none absolute bottom-0 top-0 w-px bg-rose-500"
                        style={{ left: `${(time / duration) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Inspector</h2>
                <p className={hintClass}>{selected ? selected.clip.label : "Select a clip."}</p>
              </div>
              <span className="text-xs text-slate-400">v{savedVersion}</span>
            </div>
            {selected ? (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className={labelClass}>Start (seconds)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className={`${inputClass} mt-1`}
                    value={selected.clip.startSec}
                    onChange={(event) =>
                      updateClip(selected.clip.id, { startSec: Math.max(0, Number(event.target.value)) })
                    }
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Duration (seconds)</span>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    className={`${inputClass} mt-1`}
                    value={selected.clip.durationSec}
                    onChange={(event) =>
                      updateClip(selected.clip.id, {
                        durationSec: Math.max(0.1, Number(event.target.value)),
                      })
                    }
                  />
                </label>
                {selected.clip.kind !== "text" ? (
                  <label className="block">
                    <span className={labelClass}>Source trim (seconds)</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className={`${inputClass} mt-1`}
                      value={selected.clip.sourceInSec}
                      onChange={(event) =>
                        updateClip(selected.clip.id, {
                          sourceInSec: Math.max(0, Number(event.target.value)),
                        })
                      }
                    />
                  </label>
                ) : null}
                {selected.track.kind === "overlay" || selected.clip.kind === "audio" ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={labelClass}>Sync offset</span>
                      <span className="text-xs font-medium text-slate-600">
                        {Math.round(selected.clip.startSec * 1000)} ms
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[-500, -100, 100, 500].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            updateClip(selected.clip.id, {
                              startSec: Math.max(
                                0,
                                Math.round(selected.clip.startSec * 1000 + delta) / 1000,
                              ),
                            })
                          }
                        >
                          {delta > 0 ? `+${delta}` : delta} ms
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step={10}
                        className={`${inputClass} w-24`}
                        value={Math.round(selected.clip.startSec * 1000)}
                        onChange={(event) =>
                          updateClip(selected.clip.id, {
                            startSec: Math.max(0, Number(event.target.value) / 1000),
                          })
                        }
                      />
                      <span className="text-xs text-slate-500">ms</span>
                      <button
                        type="button"
                        className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                        onClick={() => updateClip(selected.clip.id, { startSec: 0 })}
                      >
                        Reset
                      </button>
                    </div>
                    <p className={hintClass}>
                      Positive values delay this camera or audio track relative to the screen.
                    </p>
                  </div>
                ) : null}
                {selected.clip.kind === "audio" ? (
                  <label className="block">
                    <span className={labelClass}>Volume</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selected.clip.volume}
                      onChange={(event) =>
                        updateClip(selected.clip.id, { volume: Number(event.target.value) })
                      }
                      className="mt-2 w-full accent-slate-900"
                    />
                  </label>
                ) : null}
                {selected.clip.kind === "text" && selected.clip.text ? (
                  <>
                    <label className="block">
                      <span className={labelClass}>Caption</span>
                      <textarea
                        className={`${inputClass} mt-1 min-h-20`}
                        value={selected.clip.text.content}
                        onChange={(event) =>
                          updateText(selected.clip.id, { content: event.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Font size</span>
                      <input
                        type="number"
                        min={12}
                        max={160}
                        className={`${inputClass} mt-1`}
                        value={selected.clip.text.fontSize}
                        onChange={(event) =>
                          updateText(selected.clip.id, { fontSize: Number(event.target.value) })
                        }
                      />
                    </label>
                  </>
                ) : null}
                <button
                  type="button"
                  className={`${buttonDanger} w-full`}
                  onClick={() => deleteClip(selected.clip.id)}
                >
                  Delete clip
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                Pick a clip in the timeline, then adjust its start, duration, trim point or text.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Captions</h2>
              {transcription.hasTranscript ? (
                <span className="text-xs text-slate-500">
                  {transcription.segmentCount} segment
                  {transcription.segmentCount === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {transcription.hasTranscript ? (
              <>
                <p className="mt-2">Transcript is ready. Generate timed captions on the text track.</p>
                <form action={generateTimelineCaptions} className="mt-3">
                  <input type="hidden" name="timelineId" value={timelineId} />
                  <button type="submit" className={`${buttonSecondary} w-full`}>
                    Generate captions
                  </button>
                </form>
              </>
            ) : !transcription.hasAudio ? (
              <p className="mt-2">This recording has no microphone or system-audio track.</p>
            ) : transcription.jobStatus === "queued" || transcription.jobStatus === "running" ? (
              <>
                <p className="mt-2">
                  Transcription is {transcription.jobStatus}. The worker must be running.
                </p>
                <Link
                  className="mt-3 inline-block text-xs font-medium text-indigo-700"
                  href={`/timelines/${timelineId}`}
                >
                  Refresh status
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2">Transcribe the recording audio, then generate captions.</p>
                <form action={queueTimelineTranscription} className="mt-3">
                  <input type="hidden" name="timelineId" value={timelineId} />
                  <button type="submit" className={`${buttonSecondary} w-full`}>
                    {transcription.jobStatus === "failed" ? "Retry transcription" : "Transcribe recording"}
                  </button>
                </form>
                {transcription.jobError ? (
                  <p className="mt-2 text-xs text-rose-700">{transcription.jobError}</p>
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Media</h2>
            <ul className="mt-3 space-y-2">
              {assets.length === 0 ? <li className="text-slate-500">No media assets.</li> : null}
              {assets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{asset.filename}</span>
                  <a
                    className="shrink-0 text-xs font-medium text-indigo-700"
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mt-1">
              The camera is a separate overlay track. Hiding it here removes it from the preview and
              the final render without changing the raw recording.
            </p>
          </section>
        </aside>
      </div>

      {document.tracks.flatMap((track) =>
        track.clips
          .filter((clip) => clip.kind === "audio" && clip.assetId)
          .map((clip) => {
            const asset = assetMap.get(clip.assetId!);
            if (!asset) return null;
            return (
              <audio
                key={clip.id}
                ref={(element) => {
                  if (element) audioRefs.current.set(clip.id, element);
                  else audioRefs.current.delete(clip.id);
                }}
                src={asset.url}
                preload="auto"
                onLoadedMetadata={(event) => {
                  const target = clipTarget(clip, timeRef.current);
                  if (Number.isFinite(target)) event.currentTarget.currentTime = target;
                }}
              />
            );
          }),
      )}
    </div>
  );
}
