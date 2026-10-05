"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { uploadBrandFile } from "../brand-kit/brand-file-upload";
import { useUpdatePlannerPostV2 } from "../../hooks/use-planner-planning";
import { plannerMediaUrl } from "./planner-v2-utils";

/** Capa do Reel: escolhe um quadro do próprio vídeo (ou envia uma imagem) e grava como capa do post. */

const COVER_MIME_TYPE = "image/jpeg";
const COVER_QUALITY = 0.9;
const CAPTURE_ERROR = "Não deu para pegar esse quadro do vídeo. Envie uma imagem de capa.";

function captureVideoFrame(video: HTMLVideoElement): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const drawingContext = canvas.getContext("2d");
    if (!drawingContext || !canvas.width) {
      reject(new Error(CAPTURE_ERROR));
      return;
    }
    try {
      drawingContext.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(new File([blob], `capa-${Date.now()}.jpg`, { type: COVER_MIME_TYPE })) : reject(new Error(CAPTURE_ERROR))),
        COVER_MIME_TYPE,
        COVER_QUALITY,
      );
    } catch (captureError) {
      // Vídeo de outro domínio sem CORS deixa o canvas "sujo" e o navegador bloqueia a leitura.
      reject(new Error(CAPTURE_ERROR, { cause: captureError }));
    }
  });
}

export function ReelCoverPicker({ postId, videoKey, thumbnail }: { postId: string; videoKey: string; thumbnail: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const updatePost = useUpdatePlannerPostV2();
  const coverUrl = plannerMediaUrl(thumbnail);

  const seekTo = (seconds: number) => {
    setPositionSeconds(seconds);
    if (videoRef.current) videoRef.current.currentTime = seconds;
  };

  const saveCover = async (pickCoverFile: () => Promise<File>) => {
    setIsSaving(true);
    try {
      const coverKey = await uploadBrandFile(await pickCoverFile());
      await updatePost.mutateAsync({ postId, thumbnail: coverKey });
      toast.success("Capa atualizada.");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Não deu para salvar a capa.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveCurrentFrameAsCover = () => {
    const video = videoRef.current;
    if (video) void saveCover(() => captureVideoFrame(video));
  };

  const saveUploadedImageAsCover = (file: File | undefined) => {
    if (file) void saveCover(async () => file);
  };

  return (
    <section className="w-full max-w-[300px] rounded-2xl bg-background p-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Capa do Reel</p>
      <div className="flex gap-3">
        <div className="h-[124px] w-[70px] shrink-0 overflow-hidden rounded-xl bg-panel">
          {coverUrl ? (
            <img src={coverUrl} alt="Capa atual" className="size-full object-cover" />
          ) : (
            <p className="grid size-full place-items-center px-1 text-center text-[10px] text-muted-foreground">Sem capa</p>
          )}
        </div>
        <div className="h-[124px] w-[70px] shrink-0 overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            src={plannerMediaUrl(videoKey)}
            crossOrigin="anonymous"
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => setDurationSeconds(event.currentTarget.duration || 0)}
            className="size-full object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <p className="text-[11px] text-muted-foreground">Arraste para escolher o quadro.</p>
          <input
            type="range"
            aria-label="Momento do vídeo usado como capa"
            min={0}
            max={durationSeconds}
            step={0.1}
            value={positionSeconds}
            disabled={!durationSeconds || isSaving}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="w-full accent-foreground"
          />
          <button
            type="button"
            data-guide={GUIDE_ANCHORS.plannerReelCoverFromVideo.id}
            disabled={!durationSeconds || isSaving}
            onClick={saveCurrentFrameAsCover}
            className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-40"
          >
            {isSaving ? "Salvando…" : "Usar este quadro"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1 rounded-full bg-panel px-3 py-1.5 text-xs disabled:opacity-40"
          >
            <ImagePlus className="size-3.5" /> Enviar imagem
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          saveUploadedImageAsCover(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </section>
  );
}
