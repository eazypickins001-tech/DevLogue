import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function wrapText(text, maxChars) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4).join("\n");
}

export function planScenes(scenes) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("Storyboard has no scenes.");
  }
  let cursor = 0;
  return scenes.map((scene, index) => {
    const durationSec = Number(scene.durationSec);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error(`Scene ${index + 1} has an invalid duration.`);
    }
    const planned = {
      index,
      startSec: cursor,
      durationSec,
      onScreenText: wrapText(scene.onScreenText, 22),
      narration: wrapText(scene.narration, 38),
      sourceAssetId: scene.sourceAssetId ?? null,
    };
    cursor += durationSec;
    return planned;
  });
}

export function sceneInputArgs({ source, durationSec, hasAudio }) {
  const args = [];
  if (!source) {
    args.push("-f", "lavfi", "-t", String(durationSec), "-i", "color=c=0x0F172A:s=1080x1920:r=30");
  } else if (source.kind === "image") {
    args.push("-loop", "1", "-t", String(durationSec), "-i", source.path);
  } else {
    args.push("-stream_loop", "-1", "-t", String(durationSec), "-i", source.path);
  }
  if (!hasAudio) {
    args.push("-f", "lavfi", "-t", String(durationSec), "-i", "anullsrc=r=48000:cl=stereo");
  }
  return args;
}

export function sceneFilterArgs({ textFile, narrationFile, fontFile }) {
  const filters = [
    "scale=1080:1920:force_original_aspect_ratio=decrease",
    "pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0F172A",
    "setsar=1",
  ];
  const font = fontFile.replace(/\\/g, "/").replace(/:/g, "\\:");
  if (textFile) {
    filters.push(
      `drawtext=fontfile='${font}':textfile='${textFile}':fontcolor=white:fontsize=64:line_spacing=12:box=1:boxcolor=0x0F172A@0.72:boxborderw=28:x=(w-text_w)/2:y=h*0.30`,
    );
  }
  if (narrationFile) {
    filters.push(
      `drawtext=fontfile='${font}':textfile='${narrationFile}':fontcolor=white@0.92:fontsize=38:line_spacing=8:box=1:boxcolor=0x0F172A@0.62:boxborderw=20:x=(w-text_w)/2:y=h*0.68`,
    );
  }
  return ["-vf", filters.join(","), "-r", "30"];
}

export function parseWhisperJson(value) {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || !Array.isArray(parsed.segments)) {
    throw new Error("Whisper output has no segments.");
  }
  return parsed.segments
    .map((segment) => ({
      startSec: Number(segment.startSec ?? segment.start ?? 0),
      endSec: Number(segment.endSec ?? segment.end ?? 0),
      text: String(segment.text ?? "").trim(),
    }))
    .filter((segment) => segment.text.length > 0);
}

export function resolveFfmpeg(env = process.env) {
  const explicit = env.FFMPEG_PATH;
  if (explicit && existsSync(explicit)) return { ffmpeg: explicit, ffprobe: env.FFPROBE_PATH || explicit.replace(/ffmpeg\.exe$/i, "ffprobe.exe") };

  const which = spawnSync("where", ["ffmpeg"], { encoding: "utf8" });
  if (which.status === 0) {
    const path = which.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (path) return { ffmpeg: path, ffprobe: path.replace(/ffmpeg\.exe$/i, "ffprobe.exe") };
  }

  const localAppData = env.LOCALAPPDATA || "";
  const packageRoot = join(localAppData, "Microsoft", "WinGet", "Packages");
  if (packageRoot && existsSync(packageRoot)) {
    const found = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-ChildItem -Path '${packageRoot}' -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName`,
      ],
      { encoding: "utf8" },
    );
    const path = found.stdout?.trim();
    if (path && existsSync(path)) {
      return { ffmpeg: path, ffprobe: path.replace(/ffmpeg\.exe$/i, "ffprobe.exe") };
    }
  }
  throw new Error("ffmpeg was not found. Install it or set FFMPEG_PATH.");
}

export function resolveWhisper(env = process.env) {
  const python =
    env.WHISPER_PYTHON ||
    [join(root, ".venv", "bin", "python"), join(root, ".venv", "Scripts", "python.exe")].find((path) =>
      existsSync(path),
    );
  const script = join(root, "scripts", "transcribe.py");
  if (!python || !existsSync(script)) return null;
  return { python, script, model: env.WHISPER_MODEL || "base.en" };
}

export function defaultFont() {
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\segoeuib.ttf",
    "C:\\Windows\\Fonts\\arial.ttf",
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0];
}
