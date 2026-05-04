"use client";

import { useCallback, useEffect, useState } from "react";
import { DownloadIcon, Loader2Icon, RemoveFormattingIcon, WandIcon, ImageIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useImageEditor } from "./use-image-editor";
import { useBackgroundRemoval } from "./use-background-removal";
import { ImageEditorCanvas } from "./image-editor-canvas";
import { ImageFormatSelector } from "./image-format-selector";
import { ImageSourceTabs } from "./image-source-tabs";
import { FORMAT_DIMENSIONS } from "./use-image-editor";
import { PostMetaEditor } from "../post-meta-editor";

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
}

interface PostMeta {
  id: string;
  clientOrgName?: string | null;
  orgProjectId?: string | null;
  orgProject?: { id: string; name: string } | null;
  scheduledAt?: string | null;
  isAd?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  postId: string;
  plannerId: string;
  initialImageKey?: string | null;
  initialHeadline?: string | null;
  initialSubtext?: string | null;
  logoKey?: string | null;
  slides?: Slide[];
  onSaved?: (imageKey: string) => void;
  post?: PostMeta | null;
}

export function ImageEditorDialog({
  open, onOpenChange,
  postId, plannerId,
  initialImageKey, initialHeadline, initialSubtext,
  logoKey,
  slides = [],
  onSaved,
  post,
}: Props) {
  const qc = useQueryClient();
  const editor = useImageEditor(postId);
  const bgRemoval = useBackgroundRemoval();
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);

  const isCarousel = slides.length > 1;
  const currentSlide = isCarousel ? slides[selectedSlideIdx] : null;

  // Initialize state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedSlideIdx(0);
      const key = isCarousel ? slides[0]?.imageKey : initialImageKey;
      if (key) editor.setCurrentImageKey(key);
      if (initialHeadline) editor.setHeadline(initialHeadline);
      if (initialSubtext) editor.setSubtext(initialSubtext);
    } else {
      editor.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSlideSelect(idx: number) {
    setSelectedSlideIdx(idx);
    const key = slides[idx]?.imageKey;
    editor.setCurrentImageKey(key ?? null);
  }

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) editor.reset();
    onOpenChange(v);
  }, [editor, onOpenChange]);

  // Remove slide
  const removeSlide = useMutation(
    orpc.nasaPlanner.posts.removeSlide.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.nasaPlanner.posts.getMany.key() });
        setSelectedSlideIdx(0);
        toast.success("Slide removido!");
      },
      onError: () => toast.error("Erro ao remover slide"),
    }),
  );

  // Check if OpenAI integration is active
  const { data: integrationsData } = useQuery(
    orpc.platformIntegrations.getMany.queryOptions({}),
  );
  const hasOpenAI = (integrationsData?.integrations ?? []).some(
    (i: any) => i.platform === "OPENAI" && i.isActive,
  );

  // Generate image from prompt
  const generateImage = useMutation(
    orpc.nasaPlanner.posts.generateImage.mutationOptions({
      onSuccess: (data) => {
        editor.setCurrentImageKey(data.imageKey);
        toast.success(`Imagem gerada! ${data.starsSpent} star${data.starsSpent !== 1 ? "s" : ""} usada${data.starsSpent !== 1 ? "s" : ""}`);
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao gerar imagem"),
    }),
  );

  // Update slide
  const updateSlide = useMutation(
    orpc.nasaPlanner.posts.updateSlide.mutationOptions({
      onSuccess: () => {
        toast.success("Imagem salva!");
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
      onError: () => toast.error("Erro ao salvar imagem"),
    }),
  );

  // Upload image
  const uploadImage = useMutation(
    orpc.nasaPlanner.posts.uploadImage.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
    }),
  );

  // Update post (used to persist slides with headline/subtext on export)
  const updatePost = useMutation(
    orpc.nasaPlanner.posts.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
    }),
  );

  const handleGenerate = useCallback(() => {
    if (!editor.aiPrompt.trim()) return;
    generateImage.mutate({
      postId,
      prompt: editor.aiPrompt,
      quality: editor.quality,
    });
  }, [editor.aiPrompt, editor.quality, generateImage, postId]);

  // Upload a local file: resize client-side, upload to S3 via presigned URL
  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const { width: targetW, height: targetH } = FORMAT_DIMENSIONS[editor.format];

      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;

      // Cover crop
      const srcRatio = bitmap.width / bitmap.height;
      const dstRatio = targetW / targetH;
      let sx = 0, sy = 0, sw = bitmap.width, sh = bitmap.height;
      if (srcRatio > dstRatio) {
        sw = bitmap.height * dstRatio;
        sx = (bitmap.width - sw) / 2;
      } else {
        sh = bitmap.width / dstRatio;
        sy = (bitmap.height - sh) / 2;
      }
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetW, targetH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")), "image/jpeg", 0.92);
      });

      // Get presigned URL
      const resp = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `planner-upload-${Date.now()}.jpg`, contentType: "image/jpeg", size: blob.size, isImage: true }),
      });
      const { presignedUrl, key } = await resp.json();
      if (!presignedUrl) throw new Error("Presigned URL not returned");

      await fetch(presignedUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });

      editor.setCurrentImageKey(key);
      await uploadImage.mutateAsync({ postId, imageKey: key });
      toast.success("Imagem carregada!");
    } catch (err: any) {
      toast.error("Erro ao fazer upload da imagem");
      console.error(err);
    }
  }, [editor, postId, uploadImage]);

  const handleUrlLoad = useCallback(async () => {
    if (!editor.urlInput.trim()) return;
    try {
      // Fetch the image from URL to get its blob
      const imgResp = await fetch(editor.urlInput);
      if (!imgResp.ok) throw new Error("Falha ao buscar imagem da URL");
      const blob = await imgResp.blob();
      const contentType = blob.type || "image/jpeg";
      const ext = contentType.split("/")[1] ?? "jpg";

      const resp = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `planner-url-${Date.now()}.${ext}`, contentType, size: blob.size, isImage: true }),
      });
      const { presignedUrl, key } = await resp.json();
      if (!presignedUrl) throw new Error("Presigned URL not returned");

      await fetch(presignedUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
      editor.setCurrentImageKey(key);
      await uploadImage.mutateAsync({ postId, imageKey: key });
      toast.success("Imagem carregada!");
    } catch {
      toast.error("Erro ao carregar imagem da URL");
    }
  }, [editor, postId, uploadImage]);

  const handleRemoveBackground = useCallback(async () => {
    if (!editor.currentImageKey) return;
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.src = resolveUrl(editor.currentImageKey);
    await new Promise((res) => { imgEl.onload = res; imgEl.onerror = res; });
    const blob = await bgRemoval.removeBackground(imgEl);
    if (!blob) return;

    // Upload result
    const resp = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: `planner-nobg-${Date.now()}.png`, contentType: "image/png", size: blob.size, isImage: true }),
    });
    const { presignedUrl, key } = await resp.json();
    if (!presignedUrl) return;
    await fetch(presignedUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/png" } });
    editor.setCurrentImageKey(key);
    await uploadImage.mutateAsync({ postId, imageKey: key });
  }, [editor, bgRemoval, postId, uploadImage]);

  // Export canvas as PNG and upload
  const handleExport = useCallback(async () => {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    editor.setIsExporting(true);

    // Draw everything onto the hidden canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: canvasW, height: canvasH } = FORMAT_DIMENSIONS[editor.format];

    // Re-draw base image
    if (editor.currentImageKey) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = resolveUrl(editor.currentImageKey);
      await new Promise((r) => { img.onload = r; img.onerror = r; });
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = "#1e1e2e";
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Logo
    if (editor.showLogo && logoKey) {
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = logoKey ? resolveUrl(logoKey) : "";
      await new Promise((r) => { logo.onload = r; logo.onerror = r; });
      ctx.drawImage(logo, editor.logoPosition.x, editor.logoPosition.y, editor.logoSize, editor.logoSize);
    }

    // Text
    if (editor.headline) {
      ctx.font = `bold ${editor.overlay.headlineFontSize}px sans-serif`;
      ctx.fillStyle = editor.overlay.headlineColor;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 8;
      ctx.fillText(editor.headline, (editor.overlay.headlineX / 100) * canvasW, (editor.overlay.headlineY / 100) * canvasH);
      ctx.shadowBlur = 0;
    }
    if (editor.subtext) {
      ctx.font = `${editor.overlay.subtextFontSize}px sans-serif`;
      ctx.fillStyle = editor.overlay.subtextColor;
      ctx.textAlign = "center";
      ctx.shadowBlur = 4;
      ctx.fillText(editor.subtext, (editor.overlay.subtextX / 100) * canvasW, (editor.overlay.subtextY / 100) * canvasH);
      ctx.shadowBlur = 0;
    }

    const blob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob((b) => b ? res(b) : rej(new Error("toBlob failed")), "image/png");
    });

    // Upload to S3
    const resp = await fetch("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: `planner-export-${Date.now()}.png`, contentType: "image/png", size: blob.size, isImage: true }),
    });
    const { presignedUrl, key } = await resp.json();
    if (!presignedUrl) throw new Error("Presigned URL not returned");
    await fetch(presignedUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/png" } });

    await uploadImage.mutateAsync({ postId, imageKey: key });

    // Persist headline/subtext so they're shown next time the editor opens
    if (isCarousel && currentSlide) {
      await updateSlide.mutateAsync({
        slideId: currentSlide.id,
        imageKey: key,
        headline: editor.headline || null,
        subtext: editor.subtext || null,
        overlayConfig: editor.overlay as unknown as Record<string, unknown>,
        targetFormat: editor.format,
      });
    } else {
      await updatePost.mutateAsync({
        postId,
        slides: [{
          order: 0,
          imageKey: key,
          headline: editor.headline || undefined,
          subtext: editor.subtext || undefined,
          overlayConfig: editor.overlay,
        }],
      });
    }

    editor.setIsExporting(false);
    onSaved?.(key);
    toast.success("Imagem exportada e salva!");
    onOpenChange(false);
  }, [editor, logoKey, postId, uploadImage, updateSlide, updatePost, isCarousel, currentSlide, onSaved, onOpenChange]);

  const handleDownload = useCallback(() => {
    if (!editor.currentImageKey) return;
    const a = document.createElement("a");
    a.href = editor.currentImageKey ? resolveUrl(editor.currentImageKey) : "";
    a.download = `post-${postId}.png`;
    a.target = "_blank";
    a.click();
  }, [editor.currentImageKey, postId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] sm:max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-4 text-pink-500" />
            Editor de Imagem
          </DialogTitle>
        </DialogHeader>

        {/* Slide strip for carousel */}
        {isCarousel && (
          <div className="flex gap-2 px-4 py-2 border-b overflow-x-auto shrink-0 bg-muted/30">
            {slides.map((slide, idx) => (
              <div key={slide.id} className="relative shrink-0 group">
                <button
                  type="button"
                  onClick={() => handleSlideSelect(idx)}
                  className={`relative size-12 rounded-md overflow-hidden border-2 transition-all block ${
                    idx === selectedSlideIdx
                      ? "border-pink-500 shadow-md"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  {slide.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveUrl(slide.imageKey)}
                      alt={`Slide ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="size-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/50 text-white leading-4">
                    {idx + 1}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeSlide.mutate({ postId, slideId: slide.id })}
                  disabled={removeSlide.isPending}
                  className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  {removeSlide.isPending
                    ? <Loader2Icon className="size-2.5 animate-spin" />
                    : <Trash2Icon className="size-2.5" />}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Canvas preview */}
          <div className="flex-1 p-4 flex items-center justify-center min-w-0 min-h-0">
            <ImageEditorCanvas
              imageKey={editor.currentImageKey}
              logoKey={logoKey ?? null}
              headline={editor.headline}
              subtext={editor.subtext}
              overlay={editor.overlay}
              format={editor.format}
              showLogo={editor.showLogo}
              logoPosition={editor.logoPosition}
              logoSize={editor.logoSize}
              onLogoPositionChange={editor.setLogoPosition}
              canvasRef={editor.canvasRef}
            />
          </div>

          <Separator orientation="vertical" />

          {/* Controls panel */}
          <ScrollArea className="w-80 shrink-0">
            <div className="p-4 space-y-5">
              {/* Format */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formato</Label>
                <ImageFormatSelector value={editor.format} onChange={editor.setFormat} />
              </div>

              <Separator />

              {/* Image source */}
              <ImageSourceTabs
                tab={editor.sourceTab}
                onTabChange={editor.setSourceTab}
                aiPrompt={editor.aiPrompt}
                onPromptChange={editor.setAiPrompt}
                quality={editor.quality}
                onQualityChange={editor.setQuality}
                urlInput={editor.urlInput}
                onUrlChange={editor.setUrlInput}
                isGenerating={generateImage.isPending}
                onGenerate={handleGenerate}
                onFileSelect={handleFileSelect}
                onUrlLoad={handleUrlLoad}
                hasOpenAI={hasOpenAI}
              />

              {editor.currentImageKey && (
                <>
                  <Separator />

                  {/* Background removal */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ferramentas</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleRemoveBackground}
                      disabled={bgRemoval.isRemoving}
                    >
                      {bgRemoval.isRemoving
                        ? <><Loader2Icon className="size-3.5 animate-spin" />Removendo fundo...</>
                        : <><RemoveFormattingIcon className="size-3.5" />Remover Fundo</>}
                    </Button>
                  </div>
                </>
              )}

              <Separator />

              {/* Text overlay */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Texto</Label>
                <div className="space-y-1.5">
                  <Label className="text-xs">Título (headline)</Label>
                  <Input
                    value={editor.headline}
                    onChange={(e) => editor.setHeadline(e.target.value)}
                    placeholder="Título do post..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subtexto</Label>
                  <Input
                    value={editor.subtext}
                    onChange={(e) => editor.setSubtext(e.target.value)}
                    placeholder="Subtítulo ou CTA..."
                  />
                </div>
              </div>

              {logoKey && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo da Marca</Label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editor.showLogo}
                        onChange={(e) => editor.setShowLogo(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Mostrar logo</span>
                    </label>
                    {editor.showLogo && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tamanho do logo</Label>
                        <input
                          type="range"
                          min={40}
                          max={300}
                          value={editor.logoSize}
                          onChange={(e) => editor.setLogoSize(Number(e.target.value))}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">Arraste o logo no preview para reposicionar.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {post && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados do Post</Label>
                    <PostMetaEditor post={post} />
                  </div>
                </>
              )}

              <Separator />

              {/* Actions */}
              <div className="space-y-2 pb-4">
                <Button
                  className="w-full gap-2"
                  onClick={handleExport}
                  disabled={!editor.currentImageKey || editor.isExporting}
                >
                  {editor.isExporting
                    ? <><Loader2Icon className="size-4 animate-spin" />Salvando...</>
                    : <><WandIcon className="size-4" />Exportar e Salvar</>}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleDownload}
                  disabled={!editor.currentImageKey}
                >
                  <DownloadIcon className="size-3.5" />Baixar imagem
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
