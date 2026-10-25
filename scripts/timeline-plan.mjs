import { writeFileSync } from "node:fs";
import { join } from "node:path";

const TRACK_ORDER = ["video", "overlay", "text", "audio"];

function even(value) {
  const rounded = Math.max(2, Math.round(Number(value) || 0));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeFilterPath(value) {
  return String(value).replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function ffmpegColor(value, fallback) {
  const input = String(value || "").trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(input);
  if (hex) return `0x${hex[1]}`;
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(input);
  if (rgba) {
    const parts = rgba[1].split(",").map((part) => Number(part.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      const color = parts
        .slice(0, 3)
        .map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0"))
        .join("");
      const alpha = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
      return alpha < 1 ? `0x${color}@${Math.max(0, Math.min(1, alpha))}` : `0x${color}`;
    }
  }
  return input || fallback;
}

export function prepareTimelineTextFiles(document, workDir) {
  const files = new Map();
  if (!document || !Array.isArray(document.tracks)) return files;
  for (const track of document.tracks) {
    for (const clip of track.clips ?? []) {
      if (clip.kind !== "text" || !clip.text?.content?.trim()) continue;
      const safeId = String(clip.id).replace(/[^a-z0-9-]/gi, "");
      const path = join(workDir, `text-${safeId}.txt`);
      writeFileSync(path, clip.text.content);
      files.set(clip.id, path);
    }
  }
  return files;
}

export function buildTimelineArgs({ document, assetPaths, textFiles, fontFile, outputPath }) {
  if (!document || !Array.isArray(document.tracks)) {
    throw new Error("Timeline document has no tracks.");
  }
  if (!outputPath) throw new Error("Timeline output path is required.");

  const width = even(document.width || 1920);
  const height = even(document.height || 1080);
  const fps = [24, 30, 60].includes(Number(document.fps)) ? Number(document.fps) : 30;
  const clipEnd = document.tracks.reduce(
    (end, track) =>
      (track.clips ?? []).reduce(
        (trackEnd, clip) => Math.max(trackEnd, number(clip.startSec) + number(clip.durationSec)),
        end,
      ),
    0,
  );
  const duration = Math.max(0.1, number(document.durationSec, clipEnd) || clipEnd);
  const inputArgs = [
    "-f",
    "lavfi",
    "-t",
    String(duration),
    "-i",
    `color=c=0x0F172A:s=${width}x${height}:r=${fps}`,
  ];
  const filters = ["[0:v]format=rgba[base0]"];
  const audioLabels = [];
  let videoLabel = "base0";
  let nextInput = 1;
  let filterIndex = 0;

  const tracks = [...document.tracks].sort(
    (a, b) => TRACK_ORDER.indexOf(a.kind) - TRACK_ORDER.indexOf(b.kind),
  );

  for (const track of tracks) {
    if (track.hidden) continue;
    for (const clip of track.clips ?? []) {
      const start = Math.max(0, number(clip.startSec));
      const clipDuration = Math.max(0.05, number(clip.durationSec));
      const sourceIn = Math.max(0, number(clip.sourceInSec));
      const end = Math.min(duration, start + clipDuration);
      if (end <= start) continue;

      if (clip.kind === "video" || clip.kind === "overlay") {
        const assetPath = clip.assetId ? assetPaths.get(clip.assetId) : null;
        if (!assetPath) continue;
        const inputIndex = nextInput;
        nextInput += 1;
        inputArgs.push("-ss", String(sourceIn), "-t", String(clipDuration), "-i", assetPath);
        const label = `clip${filterIndex}`;
        const outputLabel = `overlay${filterIndex}`;
        filterIndex += 1;

        const parts = [
          `[${inputIndex}:v]trim=duration=${clipDuration}`,
          `setpts=PTS-STARTPTS+${start}/TB`,
        ];
        if (clip.transform?.mirror) parts.push("hflip");

        if (clip.kind === "overlay" && clip.transform) {
          const overlayWidth = even(clip.transform.width * width);
          const overlayHeight = even(clip.transform.height * height);
          parts.push(
            `scale=${overlayWidth}:${overlayHeight}:force_original_aspect_ratio=increase`,
            `crop=${overlayWidth}:${overlayHeight}`,
            "setsar=1",
            "format=rgba",
          );
          if (number(clip.transform.opacity, 1) < 1) {
            parts.push(`colorchannelmixer=aa=${Math.max(0, Math.min(1, number(clip.transform.opacity, 1)))}`);
          }
          filters.push(`${parts.join(",")}[${label}]`);
          const x = Math.max(0, Math.min(width - overlayWidth, Math.round(clip.transform.x * width)));
          const y = Math.max(0, Math.min(height - overlayHeight, Math.round(clip.transform.y * height)));
          filters.push(
            `[${videoLabel}][${label}]overlay=${x}:${y}:eof_action=pass:enable='between(t,${start},${end})'[${outputLabel}]`,
          );
        } else {
          parts.push(
            `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
            `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0F172A`,
            "setsar=1",
            "format=rgba",
          );
          filters.push(`${parts.join(",")}[${label}]`);
          filters.push(
            `[${videoLabel}][${label}]overlay=0:0:eof_action=pass:enable='between(t,${start},${end})'[${outputLabel}]`,
          );
        }
        videoLabel = outputLabel;
        continue;
      }

      if (clip.kind === "text" && clip.text) {
        const textFile = textFiles.get(clip.id);
        if (!textFile) continue;
        const text = clip.text;
        const fontSize = Math.max(12, Math.round(number(text.fontSize, 48) * (width / 1920)));
        const color = ffmpegColor(text.color, "white");
        const background = text.background ? ffmpegColor(text.background, "0x0F172A@0.65") : null;
        const x =
          text.align === "left"
            ? "w*0.05"
            : text.align === "right"
              ? "w-text_w-w*0.05"
              : "(w-text_w)/2";
        const y =
          text.position === "top"
            ? "h*0.08"
            : text.position === "center"
              ? "(h-text_h)/2"
              : "h-text_h-h*0.08";
        const box = background ? `:box=1:boxcolor=${background}:boxborderw=${Math.round(fontSize * 0.3)}` : "";
        const outputLabel = `text${filterIndex}`;
        filterIndex += 1;
        filters.push(
          `[${videoLabel}]drawtext=fontfile='${escapeFilterPath(fontFile)}':textfile='${escapeFilterPath(textFile)}':fontcolor=${color}:fontsize=${fontSize}:x=${x}:y=${y}${box}:enable='between(t,${start},${end})'[${outputLabel}]`,
        );
        videoLabel = outputLabel;
        continue;
      }

      if (clip.kind === "audio") {
        const assetPath = clip.assetId ? assetPaths.get(clip.assetId) : null;
        if (!assetPath) continue;
        const inputIndex = nextInput;
        nextInput += 1;
        inputArgs.push("-ss", String(sourceIn), "-t", String(clipDuration), "-i", assetPath);
        const label = `audio${filterIndex}`;
        filterIndex += 1;
        const volume = clip.muted ? 0 : Math.max(0, Math.min(5, number(clip.volume, 1)));
        filters.push(
          `[${inputIndex}:a]atrim=duration=${clipDuration},asetpts=PTS-STARTPTS+${start}/TB,volume=${volume},aresample=48000[${label}]`,
        );
        audioLabels.push(label);
      }
    }
  }

  if (audioLabels.length === 0) {
    const inputIndex = nextInput;
    nextInput += 1;
    inputArgs.push("-f", "lavfi", "-t", String(duration), "-i", "anullsrc=r=48000:cl=stereo");
    filters.push(`[${inputIndex}:a]atrim=duration=${duration},asetpts=PTS-STARTPTS[aout]`);
  } else if (audioLabels.length === 1) {
    filters.push(`[${audioLabels[0]}]anull[aout]`);
  } else {
    filters.push(
      `${audioLabels.map((label) => `[${label}]`).join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0,alimiter=limit=0.95[aout]`,
    );
  }

  filters.push(`[${videoLabel}]format=yuv420p[vout]`);

  return {
    args: [
      "-y",
      ...inputArgs,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      "-t",
      String(duration),
      outputPath,
    ],
    duration,
    width,
    height,
    fps,
  };
}
