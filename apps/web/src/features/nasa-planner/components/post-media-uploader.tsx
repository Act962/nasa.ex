"use client";

import { useRef, useState } from "react";
import {
  ImageIcon, VideoIcon, UploadIcon, Loader2Icon,
  MicIcon, ClipboardCopyIcon, CheckIcon, Trash2Icon, FileVideoIcon, LayersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useUploadPlannerPostImage, useAttachVideo,
  useTranscribeVideo, useRemovePostMedia, useRemovePostSlide, useAddSlidesBatch,
} from "../hooks/use-nasa-planner";

const S3_BASE = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL
  ? `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}`
  : "";

function resolveUrl(key: string) {
  return key.startsWith("http") ? key : `${S3_BASE}/${key}`;
}

interface Slide {
  id: string;
  order: number;
  imageKey?: string | null;
  videoKey?: string | null;
}

interface Props {
  postId: string;
  postType: string;
  hasImage: boolean;
  hasVideo: boolean;
  thumbnailUrl?: string | null;
  slides?: Slide[];
  onDone?: () => void;
}

export function PostMediaUploader({
  postId, postType, hasImage, hasVideo, thumbnailUrl, slides = [], onDone,
}: Props) {
  const isCarousel = postType === "CAROUSEL";
  const isReel = postType === "REEL";

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const uploadImage = useUploadPlannerPostImage();
  const addSlidesBatch = useAddSlidesBatch();
  const attachVideo = useAttachVideo();
  const transcribeVideo = useTranscribeVideo();
  const removeMedia = useRemovePostMedia();
  const removeSlide = useRemovePostSlide();

  async function uploadSingleImage(file: File, slideOrder: number) {
    const res = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, isImage: true }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Erro ao obter URL de upload"); }
    const { presignedUrl, key } = await res.json();
    await fetch(presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    await uploadImage.mutateAsync({ postId, imageKey: key, slideOrder });
    return key;
  }

  async function handleImageFile(file: File) {
    setUploading(true);
    try {
      await uploadSingleImage(file, 1);
      toast.success("Imagem adicionada!");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleCarouselFiles(files: FileList) {
    setUploading(true);
    try {
      const keys = await Promise.all(
        Array.from(files).map(async (file, i) => {
          setUploadingIdx(i + 1);
          const res = await fetch("/api/s3/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, isImage: true }),
          });
          if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Erro ao obter URL de upload"); }
          const { presignedUrl, key } = await res.json();
          await fetch(presignedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          return key as string;
        })
      );
      await addSlidesBatch.mutateAsync({ postId, imageKeys: keys });
      toast.success(`${keys.length} slide${keys.length !== 1 ? "s" : ""} adicionado${keys.length !== 1 ? "s" : ""}!`);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao fazer upload");
    } finally {
      setUploading(false);
      setUploadingIdx(null);
    }
  }

  async function handleVideoFile(file: File) {
    setUploading(true);
    try {
      const res = await fetch("/api/s3/upload-video", {
        method: "POST",
        headers: { "Content-Type": file.type, "Content-Length": String(file.size), "x-filename": file.name },
        body: file,
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Erro ao fazer upload do vídeo"); }
      const { key } = await res.json();
      await attachVideo.mutateAsync({ postId, videoKey: key });
      toast.success("Vídeo adicionado!");
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao fazer upload do vídeo");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage() {
    await removeMedia.mutateAsync({ postId, type: "image" });
    toast.success("Imagem removida!");
    onDone?.();
  }

  async function handleRemoveVideo() {
    await removeMedia.mutateAsync({ postId, type: "video" });
    setTranscript(null);
    toast.success("Vídeo removido!");
    onDone?.();
  }

  async function handleRemoveSlide(slideId: string) {
    await removeSlide.mutateAsync({ postId, slideId });
    onDone?.();
  }

  async function handleTranscribe() {
    const result = await transcribeVideo.mutateAsync({ postId });
    setTranscript(result.transcript);
  }

  function handleCopy() {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── CARROSSEL ─────────────────────────────────────────────────────────────
  if (isCarousel) {
    return (
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <LayersIcon className="size-3.5" /> Slides do carrossel
          {slides.length > 0 && (
            <Badge variant="secondary" className="ml-1">{slides.length}</Badge>
          )}
        </Label>

        {/* Slide grid */}
        {slides.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {slides.map((slide, idx) => (
              <div key={slide.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border">
                {slide.imageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveUrl(slide.imageKey)}
                    alt={`Slide ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : slide.videoKey ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileVideoIcon className="size-6 text-muted-foreground" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="size-6 text-muted-foreground/40" />
                  </div>
                )}

                {/* Order badge */}
                <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-medium rounded px-1 py-0.5">
                  {idx + 1}
                </div>

                {/* Delete overlay */}
                <button
                  type="button"
                  onClick={() => handleRemoveSlide(slide.id)}
                  disabled={removeSlide.isPending}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  {removeSlide.isPending
                    ? <Loader2Icon className="size-5 text-white animate-spin" />
                    : <Trash2Icon className="size-5 text-white drop-shadow" />}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Multi-file upload */}
        <input
          ref={carouselInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleCarouselFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => carouselInputRef.current?.click()}
          className="w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
        >
          {uploading
            ? <Loader2Icon className="size-5 animate-spin" />
            : <UploadIcon className="size-5" />}
          <span className="text-sm font-medium">
            {uploading
              ? uploadingIdx !== null ? `Enviando slide ${uploadingIdx}...` : "Enviando..."
              : slides.length > 0 ? "Adicionar mais slides" : "Selecionar imagens"}
          </span>
          <span className="text-xs">Selecione múltiplas imagens • PNG, JPG, WEBP até 20 MB cada</span>
        </button>
      </div>
    );
  }

  // ── SINGLE (STATIC / STORY / REEL) ────────────────────────────────────────
  return (
    <div className="space-y-3">
      {(hasImage || hasVideo) && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mídia atual
          </Label>

          {hasImage && (
            <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
              {thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveUrl(thumbnailUrl)}
                  alt="thumbnail"
                  className="size-12 rounded object-cover shrink-0"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="size-12 rounded bg-muted flex items-center justify-center shrink-0">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm flex-1 truncate text-muted-foreground">Imagem do post</span>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={handleRemoveImage}
                disabled={removeMedia.isPending}
              >
                {removeMedia.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2Icon className="size-3.5" />}
                Excluir
              </Button>
            </div>
          )}

          {hasVideo && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                <div className="size-12 rounded bg-muted flex items-center justify-center shrink-0">
                  <FileVideoIcon className="size-5 text-muted-foreground" />
                </div>
                <span className="text-sm flex-1 truncate text-muted-foreground">Vídeo do post</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={handleRemoveVideo}
                  disabled={removeMedia.isPending}
                >
                  {removeMedia.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2Icon className="size-3.5" />}
                  Excluir
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MicIcon className="size-3" /> Transcrição
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleTranscribe}
                    disabled={transcribeVideo.isPending}
                  >
                    {transcribeVideo.isPending ? <Loader2Icon className="size-3 animate-spin" /> : <MicIcon className="size-3" />}
                    {transcribeVideo.isPending ? "Transcrevendo..." : "Transcrever vídeo"}
                  </Button>
                </div>
                {transcript && (
                  <div className="relative">
                    <Textarea readOnly value={transcript} className="text-xs min-h-[80px] pr-8 resize-none" />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <CheckIcon className="size-3.5 text-green-500" /> : <ClipboardCopyIcon className="size-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <Separator />
        </div>
      )}

      <Tabs defaultValue={isReel ? "video" : "image"}>
        <TabsList className="w-full">
          <TabsTrigger value="image" className="flex-1 gap-1.5">
            <ImageIcon className="size-3.5" /> {hasImage ? "Trocar imagem" : "Adicionar imagem"}
          </TabsTrigger>
          <TabsTrigger value="video" className="flex-1 gap-1.5">
            <VideoIcon className="size-3.5" /> {hasVideo ? "Trocar vídeo" : "Adicionar vídeo"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="mt-3">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (!files?.length) return;
              if (files.length === 1) {
                handleImageFile(files[0]);
              } else {
                handleCarouselFiles(files);
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => imageInputRef.current?.click()}
            className="w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2Icon className="size-5 animate-spin" /> : <UploadIcon className="size-5" />}
            <span className="text-sm font-medium">{uploading ? "Enviando..." : "Clique para selecionar imagem"}</span>
            <span className="text-xs">PNG, JPG, WEBP até 20 MB</span>
          </button>
        </TabsContent>

        <TabsContent value="video" className="mt-3">
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); e.target.value = ""; }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => videoInputRef.current?.click()}
            className="w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2Icon className="size-5 animate-spin" /> : <VideoIcon className="size-5" />}
            <span className="text-sm font-medium">{uploading ? "Enviando..." : "Clique para selecionar vídeo"}</span>
            <span className="text-xs">MP4, MOV, WEBM até 500 MB</span>
          </button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
