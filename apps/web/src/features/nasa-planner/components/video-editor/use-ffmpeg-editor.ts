"use client";

import { useRef, useState, useCallback } from "react";

export interface VideoClip {
  id: string;
  key: string;
  filename: string;
  durationSeconds?: number;
  order: number;
}

interface FFmpegInstance {
  load: (opts: any) => Promise<void>;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array>;
  deleteFile: (name: string) => Promise<void>;
  exec: (args: string[]) => Promise<void>;
  on: (event: string, cb: (e: any) => void) => void;
  terminate: () => void;
}

async function fetchVideoBytes(key: string): Promise<Uint8Array> {
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
  const endpoint = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  const url = endpoint ? `${endpoint}/${key}` : `https://${bucket}.r2.dev/${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao baixar vídeo: ${key}`);
  return new Uint8Array(await res.arrayBuffer());
}

export function useFfmpegEditor() {
  const ffmpegRef = useRef<FFmpegInstance | null>(null);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return;
    try {
      // Dynamic import so FFmpeg WASM is not bundled in main chunk
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");

      const ff = new FFmpeg() as unknown as FFmpegInstance;
      ff.on("log", ({ message }: { message: string }) => {
        setLogs((l) => [...l.slice(-50), message]);
      });
      ff.on("progress", ({ progress: p }: { progress: number }) => {
        setProgress(Math.round(p * 100));
      });

      await ff.load({
        coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
      });

      ffmpegRef.current = ff;
      setLoaded(true);
    } catch (err) {
      console.error("[FFmpeg] load error:", err);
      throw err;
    }
  }, []);

  const addClip = useCallback((clip: Omit<VideoClip, "order">) => {
    setClips((prev) => [...prev, { ...clip, order: prev.length + 1 }]);
  }, []);

  const removeClip = useCallback((id: string) => {
    setClips((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      return filtered.map((c, i) => ({ ...c, order: i + 1 }));
    });
  }, []);

  const reorderClips = useCallback((newClips: VideoClip[]) => {
    setClips(newClips.map((c, i) => ({ ...c, order: i + 1 })));
  }, []);

  const mergeClips = useCallback(async (): Promise<Blob> => {
    if (!ffmpegRef.current) throw new Error("FFmpeg não carregado");
    if (clips.length === 0) throw new Error("Nenhum clipe para mesclar");

    setProcessing(true);
    setProgress(0);

    try {
      const ff = ffmpegRef.current;
      const sorted = [...clips].sort((a, b) => a.order - b.order);

      // Write all clips to FFmpeg FS
      const clipNames: string[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const name = `clip${i}.mp4`;
        clipNames.push(name);
        const bytes = await fetchVideoBytes(sorted[i].key);
        await ff.writeFile(name, bytes);
      }

      // Build concat list file
      const concatContent = clipNames.map((n) => `file '${n}'`).join("\n");
      await ff.writeFile("concat.txt", new TextEncoder().encode(concatContent));

      await ff.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat.txt",
        "-c", "copy",
        "output.mp4",
      ]);

      const data = await ff.readFile("output.mp4");

      // Cleanup
      for (const n of clipNames) await ff.deleteFile(n).catch(() => {});
      await ff.deleteFile("concat.txt").catch(() => {});
      await ff.deleteFile("output.mp4").catch(() => {});

      return new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
    } finally {
      setProcessing(false);
    }
  }, [clips]);

  const removeSilence = useCallback(async (inputKey: string): Promise<Blob> => {
    if (!ffmpegRef.current) throw new Error("FFmpeg não carregado");

    setProcessing(true);
    setProgress(0);

    try {
      const ff = ffmpegRef.current;
      const bytes = await fetchVideoBytes(inputKey);
      await ff.writeFile("input.mp4", bytes);

      // silenceremove filter: remove silence below -35dB shorter than 1s
      await ff.exec([
        "-i", "input.mp4",
        "-af", "silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-35dB",
        "-c:v", "copy",
        "no_silence.mp4",
      ]);

      const data = await ff.readFile("no_silence.mp4");
      await ff.deleteFile("input.mp4").catch(() => {});
      await ff.deleteFile("no_silence.mp4").catch(() => {});

      return new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
    } finally {
      setProcessing(false);
    }
  }, []);

  return {
    clips,
    processing,
    progress,
    logs,
    loaded,
    loadFFmpeg,
    addClip,
    removeClip,
    reorderClips,
    mergeClips,
    removeSilence,
  };
}
