import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { AwsClient } from "aws4fetch";
import {
  defaultFont,
  parseWhisperJson,
  planScenes,
  resolveFfmpeg,
  resolveWhisper,
  sceneFilterArgs,
  sceneInputArgs,
} from "./render-plan.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const once = process.argv.includes("--once");

function loadEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}

function r2Config() {
  const accountId = required("R2_ACCOUNT_ID");
  const bucket = required("R2_BUCKET");
  const client = new AwsClient({
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  return { client, base };
}

function objectUrl(base, key) {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function signedGet(client, base, key) {
  const url = new URL(objectUrl(base, key));
  url.searchParams.set("X-Amz-Expires", "900");
  const signed = await client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

async function downloadAsset(client, base, key, destination) {
  const url = await signedGet(client, base, key);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`R2 download failed (${response.status}).`);
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

async function uploadAsset(client, base, key, filePath, contentType) {
  const signed = await client.sign(objectUrl(base, key), {
    method: "PUT",
    headers: { "content-type": contentType },
  });
  const response = await fetch(signed.url, {
    method: "PUT",
    headers: signed.headers,
    body: readFileSync(filePath),
  });
  if (!response.ok) throw new Error(`R2 upload failed (${response.status}).`);
}

function ffprobeArgs(ffprobe, filePath) {
  return [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ];
}

async function validateVideo(ffprobe, filePath, targetDurationSec) {
  const { stdout } = await run(ffprobe, ffprobeArgs(ffprobe, filePath));
  const probe = JSON.parse(stdout);
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format?.duration ?? 0);
  if (!video) throw new Error("Rendered file has no video stream.");
  if (!audio) throw new Error("Rendered file has no audio stream.");
  if (video.width !== 1080 || video.height !== 1920) {
    throw new Error(`Rendered size is ${video.width}x${video.height}, expected 1080x1920.`);
  }
  if (duration < targetDurationSec - 2 || duration > targetDurationSec + 3) {
    throw new Error(
      `Rendered duration ${duration.toFixed(1)}s is outside the ${targetDurationSec}s target.`,
    );
  }
  return { duration, width: video.width, height: video.height, audio: audio.codec_name };
}

async function transcribeAssets({ sql, client, base, assets, workDir }) {
  const whisper = resolveWhisper();
  if (!whisper) {
    console.log("whisper: not available (venv or scripts/transcribe.py missing)");
    return;
  }
  for (const asset of assets) {
    if (!["video", "audio"].includes(asset.kind)) continue;
    const existing = await sql`select id from transcripts where media_asset_id = ${asset.id} limit 1`;
    if (existing.length > 0) continue;
    try {
      console.log(`whisper: transcribing ${asset.filename}`);
      const input = join(workDir, `source-${asset.id}${asset.kind === "audio" ? ".audio" : ".mp4"}`);
      await downloadAsset(client, base, asset.storage_key, input);
      const output = join(workDir, `transcript-${asset.id}.json`);
      await run(whisper.python, [
        whisper.script,
        "--input",
        input,
        "--output",
        output,
        "--model",
        whisper.model,
      ]);
      const parsed = JSON.parse(readFileSync(output, "utf8"));
      const segments = parseWhisperJson(parsed);
      if (segments.length === 0) {
        console.log(`whisper: no speech detected in ${asset.filename}`);
        continue;
      }
      await sql`
        insert into transcripts (media_asset_id, language, text, segments, source)
        values (${asset.id}, ${parsed.language || "en"}, ${parsed.text || ""}, ${JSON.stringify(segments)}::jsonb, 'whisper')
      `;
      console.log(`whisper: stored ${segments.length} segments for ${asset.filename}`);
    } catch (error) {
      console.log(`whisper: skipped ${asset.filename}: ${error.message}`);
    }
  }
}

async function processJob(job) {
  const sql = neon(required("DATABASE_URL"));
  const { client, base } = r2Config();
  const { ffmpeg, ffprobe } = resolveFfmpeg();
  const fontFile = process.env.RENDER_FONT || defaultFont();
  const workDir = join(root, ".worker-tmp", job.id);
  mkdirSync(workDir, { recursive: true });

  const rows = await sql`
    select d.id as draft_id, d.project_id, d.session_id, d.title as draft_title,
           p.user_id, sb.id as storyboard_id, sb.target_duration_sec,
           bs.title as session_title
    from content_drafts d
    join projects p on p.id = d.project_id
    left join storyboards sb on sb.draft_id = d.id
    left join build_sessions bs on bs.id = d.session_id
    where d.id = ${job.draft_id}
    limit 1
  `;
  const draft = rows[0];
  if (!draft) throw new Error("Draft not found.");
  if (!draft.storyboard_id) throw new Error("Draft has no storyboard.");

  const scenes = await sql`
    select * from storyboard_scenes where storyboard_id = ${draft.storyboard_id} order by scene_index
  `;
  const assets = draft.session_id
    ? await sql`
        select * from media_assets
        where session_id = ${draft.session_id}
          and coalesce(notes, '') <> 'Rendered by the local worker'
      `
    : [];
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  await transcribeAssets({ sql, client, base, assets, workDir });

  const planned = planScenes(
    scenes.map((scene) => ({
      durationSec: scene.duration_sec,
      onScreenText: scene.on_screen_text,
      narration: scene.narration,
      sourceAssetId: scene.source_asset_id,
    })),
  );

  const sceneFiles = [];
  for (const scene of planned) {
    const asset = scene.sourceAssetId ? assetMap.get(scene.sourceAssetId) : null;
    let source = null;
    if (asset && ["image", "video"].includes(asset.kind)) {
      const dot = asset.filename.lastIndexOf(".");
      const extension = dot >= 0 ? asset.filename.slice(dot) : asset.kind === "image" ? ".png" : ".mp4";
      const path = join(workDir, `asset-${scene.index}${extension}`);
      await downloadAsset(client, base, asset.storage_key, path);
      source = { kind: asset.kind, path };
    }

    const textFile = join(workDir, `scene-${scene.index}-text.txt`);
    const narrationFile = join(workDir, `scene-${scene.index}-narration.txt`);
    writeFileSync(textFile, scene.onScreenText || " ");
    writeFileSync(narrationFile, scene.narration || " ");

    const output = join(workDir, `scene-${scene.index}.mp4`);
    const args = [
      "-y",
      ...sceneInputArgs({ source, durationSec: scene.durationSec, hasAudio: false }),
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      ...sceneFilterArgs({
        textFile: scene.onScreenText ? basename(textFile) : null,
        narrationFile: scene.narration ? basename(narrationFile) : null,
        fontFile,
      }),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-t",
      String(scene.durationSec),
      output,
    ];
    console.log(`render: scene ${scene.index + 1}/${planned.length} (${scene.durationSec}s)`);
    await run(ffmpeg, args, { cwd: workDir });
    sceneFiles.push(output);
  }

  const listFile = join(workDir, "scenes.txt");
  writeFileSync(
    listFile,
    sceneFiles.map((file) => `file '${file.replace(/\\/g, "/")}'`).join("\n") + "\n",
  );
  const rendered = join(workDir, "rendered.mp4");
  await run(ffmpeg, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    rendered,
  ]);

  const probe = await validateVideo(ffprobe, rendered, draft.target_duration_sec);
  const outputKey = `renders/${draft.project_id}/${draft.draft_id}/${job.id}.mp4`;
  await uploadAsset(client, base, outputKey, rendered, "video/mp4");

  const size = statSync(rendered).size;
  const media = await sql`
    insert into media_assets (user_id, project_id, session_id, kind, filename, storage_key, content_type, size_bytes, is_private, notes, duration_seconds, width, height)
    values (${draft.user_id}, ${draft.project_id}, ${draft.session_id}, 'video', ${`render-${draft.draft_id.slice(0, 8)}.mp4`}, ${outputKey}, 'video/mp4', ${size}, true, 'Rendered by the local worker', ${String(probe.duration)}, ${probe.width}, ${probe.height})
    returning id
  `;

  await sql`
    update render_jobs
    set status = 'succeeded', output_key = ${outputKey}, error = null, updated_at = now(),
        command = ${JSON.stringify({ scenes: planned.length, duration: probe.duration, mediaAssetId: media[0].id })}::jsonb
    where id = ${job.id}
  `;
  console.log(`render: succeeded ${outputKey} (${probe.duration.toFixed(1)}s, ${probe.audio})`);
  rmSync(workDir, { recursive: true, force: true });
}

async function claimJob(sql) {
  const rows = await sql`
    update render_jobs
    set status = 'running', attempts = attempts + 1, updated_at = now()
    where id = (
      select id from render_jobs where status = 'queued' order by created_at limit 1 for update skip locked
    )
    returning *
  `;
  return rows[0] ?? null;
}

async function failJob(sql, job, error) {
  const message = error instanceof Error ? error.message : String(error);
  await sql`
    update render_jobs set status = 'failed', error = ${message.slice(0, 2000)}, updated_at = now()
    where id = ${job.id}
  `;
  console.log(`render: failed ${job.id}: ${message}`);
  const workDir = join(root, ".worker-tmp", job.id);
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
}

async function main() {
  loadEnv();
  const sql = neon(required("DATABASE_URL"));
  const { ffmpeg } = resolveFfmpeg();
  console.log(`worker: ffmpeg=${ffmpeg}`);
  console.log(`worker: whisper=${resolveWhisper() ? "ready" : "disabled"}`);
  console.log(`worker: polling ${once ? "once" : "every 10s"}`);

  do {
    const job = await claimJob(sql);
    if (job) {
      try {
        await processJob(job);
      } catch (error) {
        await failJob(sql, job, error);
      }
    } else if (once) {
      console.log("worker: no queued jobs");
    }
    if (!once) await new Promise((resolvePromise) => setTimeout(resolvePromise, 10_000));
  } while (!once);
}

main().catch((error) => {
  console.error(`worker: fatal: ${error.message}`);
  process.exitCode = 1;
});
