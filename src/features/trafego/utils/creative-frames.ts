/**
 * Quadros do criativo tirados no navegador (spec 0126, RNF-2, D-5): a imagem
 * reduzida e, no vídeo, até 4 quadros. Só isso vai para a análise; nada de
 * ffmpeg no servidor. Vídeo que o navegador não decodifica volta sem quadros (CB-6).
 */

const MAX_FRAME_SIDE_PX = 1280;
const JPEG_QUALITY = 0.82;
const VIDEO_LOAD_TIMEOUT_MS = 15_000;

export interface CreativeFramesResult {
  kind: "IMAGE" | "VIDEO";
  frames: string[];
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

function drawToDataUrl(source: CanvasImageSource, width: number, height: number): string {
  const scale = Math.min(1, MAX_FRAME_SIDE_PX / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

async function readImageFrames(file: File): Promise<CreativeFramesResult> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return {
      kind: "IMAGE",
      frames: [drawToDataUrl(image, image.naturalWidth, image.naturalHeight)],
      width: image.naturalWidth,
      height: image.naturalHeight,
      durationSeconds: null,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function waitForEvent(video: HTMLVideoElement, eventName: "loadeddata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Tempo esgotado ao ler o vídeo")), VIDEO_LOAD_TIMEOUT_MS);
    video.addEventListener(
      eventName,
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error("O navegador não conseguiu ler o vídeo"));
      },
      { once: true },
    );
  });
}

async function readVideoFrames(file: File): Promise<CreativeFramesResult> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;
  try {
    await waitForEvent(video, "loadeddata");
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const width = video.videoWidth || null;
    const height = video.videoHeight || null;
    // Começo, 1 s, 3 s e meio: o gancho pesa mais que o resto.
    const timestamps = [...new Set([0.1, 1, 3, duration / 2].filter((time) => time < duration).map((time) => Math.round(time * 10) / 10))];
    const frames: string[] = [];
    for (const time of timestamps.slice(0, 4)) {
      video.currentTime = time;
      await waitForEvent(video, "seeked");
      if (width && height) frames.push(drawToDataUrl(video, width, height));
    }
    return { kind: "VIDEO", frames, width, height, durationSeconds: duration ? Math.round(duration) : null };
  } catch {
    return { kind: "VIDEO", frames: [], width: null, height: null, durationSeconds: null };
  } finally {
    video.removeAttribute("src");
    URL.revokeObjectURL(objectUrl);
  }
}

export async function readCreativeFrames(file: File): Promise<CreativeFramesResult> {
  return file.type.startsWith("video/") ? readVideoFrames(file) : readImageFrames(file);
}
