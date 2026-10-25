import {
  cameraRect,
  previewSize,
  type RecordingOptions,
} from "@/lib/recording/types";

type Streams = {
  display: MediaStream | null;
  camera: MediaStream | null;
};

function drawCover(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    video,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function drawContain(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    video,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

export function drawRecordingFrame(
  canvas: HTMLCanvasElement,
  screenVideo: HTMLVideoElement | null,
  cameraVideo: HTMLVideoElement | null,
  options: RecordingOptions,
): void {
  const size = previewSize(options.aspect);
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }

  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const hasScreen = Boolean(screenVideo && screenVideo.readyState >= 2);
  const hasCamera = Boolean(cameraVideo && cameraVideo.readyState >= 2);
  const showCamera = options.cameraMode === "pip" && hasCamera;

  if (options.source === "camera") {
    if (hasCamera && cameraVideo) {
      context.save();
      if (options.mirrorCamera) {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      drawContain(context, cameraVideo, 0, 0, canvas.width, canvas.height);
      context.restore();
    }
    return;
  }

  if (hasScreen && screenVideo) {
    drawContain(context, screenVideo, 0, 0, canvas.width, canvas.height);
  }

  if (!showCamera || !cameraVideo) return;

  const rect = cameraRect(options.aspect, options.cameraPosition, options.cameraSize);
  const x = rect.x * canvas.width;
  const y = rect.y * canvas.height;
  const width = rect.width * canvas.width;
  const height = rect.height * canvas.height;

  context.save();
  roundedRect(context, x, y, width, height, Math.min(width, height) * 0.18);
  context.clip();
  context.translate(x + width, y);
  context.scale(-1, 1);
  if (options.mirrorCamera) {
    drawCover(context, cameraVideo, 0, 0, width, height);
  } else {
    context.setTransform(1, 0, 0, 1, 0, 0);
    drawCover(context, cameraVideo, x, y, width, height);
  }
  context.restore();

  context.save();
  roundedRect(context, x, y, width, height, Math.min(width, height) * 0.18);
  context.strokeStyle = "rgba(255,255,255,0.85)";
  context.lineWidth = Math.max(2, canvas.width / 480);
  context.stroke();
  context.restore();
}

export function startPreviewLoop(
  canvas: HTMLCanvasElement,
  getVideos: () => { screen: HTMLVideoElement | null; camera: HTMLVideoElement | null },
  getOptions: () => RecordingOptions,
): () => void {
  let frame = 0;
  const draw = () => {
    const videos = getVideos();
    drawRecordingFrame(canvas, videos.screen, videos.camera, getOptions());
    frame = window.requestAnimationFrame(draw);
  };
  draw();
  return () => window.cancelAnimationFrame(frame);
}
