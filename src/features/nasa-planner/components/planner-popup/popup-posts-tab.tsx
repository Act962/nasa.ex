"use client";

import { useState, useEffect } from "react";
import { useCreatePlannerPostFromAction, useCreatePlannerPostQuietly, useGeneratePlannerPostImageWithModel } from "../../hooks/use-nasa-planner";
import { useOrgBrandKit } from "../../hooks/use-planner-org-brand";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ImageIcon, Link2, Upload, AlertCircle, X, Check } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { type ActionContext, type ImageModel, MODEL_CATALOG, resolveR2Url } from "./popup-shared";

/** Aba Posts do popup do Planner: compõe o prompt, cria o post só ao gerar e mostra a imagem. */

interface PostsTabProps {
  plannerId: string;
  actionContext?: ActionContext;
  onBrandingNavigate: () => void;
}

export function PopupPostsTab({
  plannerId,
  actionContext,
  onBrandingNavigate,
}: PostsTabProps) {
  // Estado local do form — só vira post no DB quando o usuário clica em
  // "Gerar imagem". Lazy creation evita poluir o Planner com rascunhos
  // toda vez que abre o popup.
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("ideogram_balanced");
  const [aspectRatio, setAspectRatio] = useState<
    "1x1" | "9x16" | "16x9" | "4x5" | "5x4"
  >("1x1");
  const [referenceMode, setReferenceMode] = useState<"upload" | "url">("url");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceFileName, setReferenceFileName] = useState("");
  const [uploadingRef, setUploadingRef] = useState(false);
  const [generatedImageKey, setGeneratedImageKey] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    modelUsed: string;
    starsSpent: number;
    brandApplied: boolean;
  } | null>(null);

  // Pré-popula com primeira URL do anexo do card (se houver) — só UMA vez
  useEffect(() => {
    if (actionContext?.attachmentUrls?.[0] && !referenceUrl) {
      setReferenceUrl(actionContext.attachmentUrls[0]);
    }
  }, [actionContext?.actionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brand kit pro indicador
  const { brandKit } = useOrgBrandKit();

  const createFromAction = useCreatePlannerPostFromAction();
  const createBlank = useCreatePlannerPostQuietly();
  const generateImage = useGeneratePlannerPostImageWithModel();

  /**
   * Faz upload da imagem de referência via presigned URL pro R2 — mesmo
   * pattern que `post-media-uploader.tsx` usa pros slides do post.
   * Retorna a URL pública pra usar no preview e no prompt.
   */
  async function handleReferenceUpload(file: File) {
    setUploadingRef(true);
    try {
      const res = await fetch("/api/s3/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          isImage: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Erro ao obter URL de upload");
      }
      const { presignedUrl, key } = await res.json();
      await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      // Monta a URL pública (CDN do R2) pra usar como referência
      const publicUrl = resolveR2Url(key);
      setReferenceUrl(publicUrl);
      setReferenceFileName(file.name);
      toast.success("Imagem de referência carregada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload");
    } finally {
      setUploadingRef(false);
    }
  }

  /**
   * Cria o post (se ainda não existe) e dispara a geração de imagem.
   * **Lazy creation**: o post só nasce no DB aqui — não quando o popup
   * abre, conforme feedback do usuário.
   */
  async function handleGenerate() {
    if (!prompt || prompt.length < 5) return;
    let postId = activePostId;
    if (!postId) {
      try {
        if (actionContext) {
          // Veio do card de evento: cria post vinculado ao actionId
          // (caption já é copiada do action.description pela procedure)
          const created = await createFromAction.mutateAsync({
            actionId: actionContext.actionId,
            plannerId,
            type: "STATIC",
          });
          postId = created.post.id;
        } else {
          // Standalone: cria post em branco
          const created = await createBlank.mutateAsync({
            plannerId,
            type: "STATIC",
            title: "Novo post",
          });
          postId = created.post.id;
        }
        if (!postId) return;
        setActivePostId(postId);
      } catch {
        return; // toast já disparado nos onError
      }
    }

    generateImage.mutate(
      {
        postId,
        prompt,
        model,
        aspectRatio,
        referenceImageUrl: referenceUrl || undefined,
        negativePrompt: negativePrompt || undefined,
      },
      {
        onSuccess: (generated) => {
          setGeneratedImageKey(generated.imageKey);
          setLastResult({
            modelUsed: generated.modelUsed,
            starsSpent: generated.starsSpent,
            brandApplied: generated.brandApplied,
          });
        },
      },
    );
  }

  const selectedModel = MODEL_CATALOG.find((m) => m.value === model)!;
  const brandKitComplete = brandKit?.kitComplete ?? false;
  const creating = createFromAction.isPending || createBlank.isPending;
  const generating = generateImage.isPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 lg:gap-8 flex-1 min-h-0">
      {/* ── Form esquerdo ── */}
      <div className="space-y-4 min-w-0">
        {/* Brand kit indicator */}
        {brandKitComplete ? (
          <div className="flex items-center gap-2 rounded-lg bg-success/15 border border-success/30 px-3 py-2 text-xs">
            <Check className="size-3.5 text-success shrink-0" />
            <span>Brand kit aplicado: paleta + fontes da marca</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onBrandingNavigate}
            className="flex items-center gap-2 rounded-lg bg-warning/15 border border-warning/30 hover:border-warning/40 px-3 py-2 text-xs w-full text-left transition"
          >
            <AlertCircle className="size-3.5 text-warning shrink-0" />
            <span className="flex-1">
              Brand kit incompleto.{" "}
              <strong className="underline">Configurar agora →</strong>
            </span>
          </button>
        )}

        {/* Caption do card */}
        {actionContext?.description && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Legenda (vinda do card)
            </Label>
            <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs leading-relaxed max-h-20 overflow-y-auto">
              {actionContext.description.slice(0, 400)}
              {actionContext.description.length > 400 ? "..." : ""}
            </div>
          </div>
        )}

        {/* Prompt */}
        <div className="space-y-1.5">
          <Label htmlFor="prompt">Prompt da imagem</Label>
          <Textarea
            id="prompt"
            placeholder="Ex: Card de divulgação Lift BumBum com Dra. Thaine. Imagem de procedimento de glúteo. Título grande 'Lift BumBum' em fonte serifada elegante. Footer com @drathainemalinowski."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <p className="text-[10px] text-muted-foreground">
            O brand kit (paleta, fontes, slogan) é injetado automaticamente.
          </p>
        </div>

        {/* Referência: upload OU URL — ambos funcionais */}
        <div className="space-y-1.5">
          <Label>Imagem de referência (opcional)</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={referenceMode === "url" ? "default" : "outline"}
              onClick={() => setReferenceMode("url")}
              className="gap-1.5 flex-1 sm:flex-none"
            >
              <Link2 className="size-3" /> URL
            </Button>
            <Button
              type="button"
              size="sm"
              variant={referenceMode === "upload" ? "default" : "outline"}
              onClick={() => setReferenceMode("upload")}
              className="gap-1.5 flex-1 sm:flex-none"
            >
              <Upload className="size-3" /> Upload
            </Button>
          </div>
          {referenceMode === "url" && (
            <Input
              placeholder="https://example.com/referencia.jpg"
              value={referenceUrl}
              onChange={(e) => {
                setReferenceUrl(e.target.value);
                setReferenceFileName("");
              }}
              type="url"
            />
          )}
          {referenceMode === "upload" && (
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReferenceUpload(file);
                    e.target.value = ""; // permite reupload do mesmo file
                  }}
                  disabled={uploadingRef}
                />
                <div className="rounded-md border border-dashed px-3 py-2 text-xs text-center hover:bg-muted/40 transition flex items-center justify-center gap-2 h-10">
                  {uploadingRef ? (
                    <>
                      <OrbitaSpinner className="size-3.5 " />
                      Subindo...
                    </>
                  ) : referenceFileName ? (
                    <>
                      <Check className="size-3.5 text-success" />
                      <span className="truncate">{referenceFileName}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5" />
                      Selecionar arquivo
                    </>
                  )}
                </div>
              </label>
            </div>
          )}
          {referenceUrl && (
            <div className="rounded-lg overflow-hidden border w-24 h-24 sm:w-32 sm:h-32 relative bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceUrl}
                alt="Referência"
                className="w-full h-full object-cover"
                onError={(e) =>
                  ((e.target as HTMLImageElement).style.display = "none")
                }
              />
              <button
                type="button"
                onClick={() => {
                  setReferenceUrl("");
                  setReferenceFileName("");
                }}
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
                aria-label="Remover referência"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        {/* Modelo IA */}
        <div className="space-y-1.5">
          <Label htmlFor="model">Modelo de IA</Label>
          <Select
            value={model}
            onValueChange={(v) => setModel(v as ImageModel)}
          >
            <SelectTrigger id="model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_CATALOG.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground text-xs ml-auto">
                      {m.stars}★
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {selectedModel.hint}
          </p>
        </div>

        {/* Aspect ratio */}
        <div className="space-y-1.5">
          <Label htmlFor="ratio">Proporção</Label>
          <Select
            value={aspectRatio}
            onValueChange={(v) => setAspectRatio(v as typeof aspectRatio)}
          >
            <SelectTrigger id="ratio">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1x1">1:1 (Feed quadrado)</SelectItem>
              <SelectItem value="9x16">9:16 (Story / Reel)</SelectItem>
              <SelectItem value="4x5">4:5 (Feed retrato)</SelectItem>
              <SelectItem value="16x9">16:9 (paisagem)</SelectItem>
              <SelectItem value="5x4">5:4 (impressão)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Negative prompt */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Avançado: prompt negativo
          </summary>
          <div className="mt-2 space-y-1.5">
            <Textarea
              placeholder="Ex: watermark, low quality, distorted hands"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              className="resize-none text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Coisas pra EVITAR na imagem. Suportado por Ideogram.
            </p>
          </div>
        </details>

        <Button
          onClick={handleGenerate}
          disabled={!prompt || prompt.length < 5 || creating || generating}
          className="w-full gap-2"
        >
          {creating ? (
            <>
              <OrbitaSpinner className="size-4 " /> Criando post...
            </>
          ) : generating ? (
            <>
              <OrbitaSpinner className="size-4 " />
              Gerando via {selectedModel.label}...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Gerar imagem ({selectedModel.stars}★)
            </>
          )}
        </Button>
      </div>

      {/* ── Preview direito ── */}
      <div className="space-y-3 min-w-0">
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div
          className={
            "rounded-xl border bg-muted/30 overflow-hidden flex items-center justify-center mx-auto " +
            (aspectRatio === "9x16"
              ? "aspect-[9/16] max-w-[280px] sm:max-w-xs"
              : aspectRatio === "16x9"
                ? "aspect-video w-full max-w-3xl"
                : aspectRatio === "4x5"
                  ? "aspect-[4/5] max-w-sm"
                  : aspectRatio === "5x4"
                    ? "aspect-[5/4] w-full max-w-md"
                    : "aspect-square max-w-sm")
          }
        >
          {generating ? (
            <Skeleton className="w-full h-full" />
          ) : generatedImageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveR2Url(generatedImageKey)}
              alt="Imagem gerada"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center text-muted-foreground p-6">
              <ImageIcon className="size-12 mx-auto mb-2 opacity-30" />
              <p className="text-xs">A imagem aparece aqui após gerar</p>
            </div>
          )}
        </div>

        {lastResult && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
            <p>
              <strong>Modelo:</strong> {lastResult.modelUsed}
            </p>
            <p>
              <strong>STARs gastas:</strong> {lastResult.starsSpent}★
            </p>
            <p>
              <strong>Brand aplicado:</strong>{" "}
              {lastResult.brandApplied ? (
                <span className="text-success">✓ Sim</span>
              ) : (
                <span className="text-warning">✗ Brand kit incompleto</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
