"use client";

/**
 * PlannerPopup — NASA Planner 2.0.
 *
 * Popup ancorado em cards de evento do Workspace (`view-action-modal`)
 * com 4 abas: **Campanhas**, **Posts**, **Mapa Mental**, **Branding**.
 *
 * Substitui o antigo `ActionToPlannerDialog`. Toda a criação de conteúdo
 * acontece dentro deste popup, com:
 *  - Upload OU URL de imagem de referência (ambos funcionais)
 *  - Seleção de modelo IA (Ideogram 3.0 Quality/Balanced/Turbo, DALL-E
 *    3, Pollinations) com STARs visíveis
 *  - Prompt + negative prompt
 *  - Brand kit aplicado automaticamente
 *  - Preview da imagem gerada
 *
 * Quando aberto via "Criar com Planner" no Workspace, o `actionContext`
 * é guardado em estado mas o post NÃO é criado automaticamente. O post
 * só nasce quando o usuário clica em **Gerar imagem** (lazy creation).
 * Antes disso, o popup é apenas uma UI de composição.
 *
 * Layout: ocupa 90vw × 90vh em desktop, full-screen no mobile. Responsivo
 * em todas as larguras.
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  ImageIcon,
  Link2,
  Upload,
  Palette,
  Megaphone,
  Brain,
  FileText,
  Loader2,
  AlertCircle,
  X,
  Check,
} from "lucide-react";

export interface ActionContext {
  actionId: string;
  title: string;
  description: string | null;
  attachmentUrls: string[];
}

interface PlannerPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionContext?: ActionContext;
  initialPlannerId?: string;
}

type ImageModel =
  | "ideogram_quality"
  | "ideogram_balanced"
  | "ideogram_turbo"
  | "dalle3_hd"
  | "dalle3_standard"
  | "pollinations";

interface ModelInfo {
  value: ImageModel;
  label: string;
  stars: number;
  hint: string;
}

const MODEL_CATALOG: ModelInfo[] = [
  {
    value: "ideogram_quality",
    label: "Ideogram 3.0 Quality",
    stars: 6,
    hint: "Melhor pra cards com TIPOGRAFIA legível. Recomendado pra publicação.",
  },
  {
    value: "ideogram_balanced",
    label: "Ideogram 3.0 Balanced",
    stars: 4,
    hint: "Padrão — bom custo-benefício pra iteração.",
  },
  {
    value: "ideogram_turbo",
    label: "Ideogram 3.0 Turbo",
    stars: 3,
    hint: "Rápido (~5s). Bom pra brainstorming.",
  },
  {
    value: "dalle3_hd",
    label: "DALL-E 3 HD",
    stars: 5,
    hint: "Bom pra fotos/cenas realistas. Tipografia inconsistente.",
  },
  {
    value: "dalle3_standard",
    label: "DALL-E 3 Standard",
    stars: 3,
    hint: "Fallback OK quando Ideogram não disponível.",
  },
  {
    value: "pollinations",
    label: "Pollinations (gratuito)",
    stars: 1,
    hint: "Grátis, qualidade inconsistente. Último recurso.",
  },
];

export function PlannerPopup({
  open,
  onOpenChange,
  actionContext,
  initialPlannerId,
}: PlannerPopupProps) {
  const [tab, setTab] = useState<"campaigns" | "posts" | "mindmap" | "branding">(
    actionContext ? "posts" : "campaigns",
  );

  const { data: plannersData } = useQuery({
    ...orpc.nasaPlanner.planners.list.queryOptions({}),
    enabled: open,
  });
  const planners = plannersData?.planners ?? [];
  const plannerId = initialPlannerId ?? planners[0]?.id ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          // Mobile: full-screen sem bordas; ≥sm: 90vw × 90vh com margem
          "p-0 gap-0 flex flex-col overflow-hidden",
          "w-screen h-[100dvh] max-w-none rounded-none",
          "sm:w-[90vw] sm:h-[90vh] sm:max-w-[1400px] sm:rounded-xl",
        ].join(" ")}
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="size-4 sm:size-5 text-violet-500 shrink-0" />
            <span>NASA Planner</span>
            {actionContext && (
              <span className="text-xs sm:text-sm font-normal text-muted-foreground truncate">
                — "{actionContext.title}"
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex-1 flex flex-col overflow-hidden min-h-0"
        >
          <div className="px-4 sm:px-6 pt-3 border-b shrink-0 overflow-x-auto">
            <TabsList className="grid grid-cols-4 w-full min-w-[420px] sm:min-w-0 sm:w-auto sm:inline-grid">
              <TabsTrigger value="campaigns" className="gap-1.5 text-xs sm:text-sm">
                <Megaphone className="size-3.5" />
                <span className="hidden sm:inline">Campanhas</span>
              </TabsTrigger>
              <TabsTrigger value="posts" className="gap-1.5 text-xs sm:text-sm">
                <FileText className="size-3.5" />
                <span className="hidden sm:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="mindmap" className="gap-1.5 text-xs sm:text-sm">
                <Brain className="size-3.5" />
                <span className="hidden sm:inline">Mapa Mental</span>
              </TabsTrigger>
              <TabsTrigger value="branding" className="gap-1.5 text-xs sm:text-sm">
                <Palette className="size-3.5" />
                <span className="hidden sm:inline">Branding</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="posts"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0 data-[state=active]:flex flex-col"
          >
            {plannerId ? (
              <PostsTab
                plannerId={plannerId}
                actionContext={actionContext}
                onBrandingNavigate={() => setTab("branding")}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Carregando planner...
              </p>
            )}
          </TabsContent>

          <TabsContent
            value="campaigns"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <PlaceholderTab
              icon={<Megaphone className="size-8" />}
              title="Campanhas"
              description="Wizard 5W2H + gestão de campanhas. (Reusa CampaignsTab da página standalone — refator em andamento, próximo PR.)"
            />
          </TabsContent>

          <TabsContent
            value="mindmap"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <PlaceholderTab
              icon={<Brain className="size-8" />}
              title="Mapa Mental"
              description="Brainstorm visual de ideias pra campanha. (Reusa MindMapsTab — refator em andamento.)"
            />
          </TabsContent>

          <TabsContent
            value="branding"
            className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 mt-0"
          >
            <BrandingTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Posts Tab ───────────────────────────────────────────────────────────────

interface PostsTabProps {
  plannerId: string;
  actionContext?: ActionContext;
  onBrandingNavigate: () => void;
}

function PostsTab({
  plannerId,
  actionContext,
  onBrandingNavigate,
}: PostsTabProps) {
  const qc = useQueryClient();
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
  const { data: brandKit } = useQuery({
    ...orpc.brand.getBrandKit.queryOptions({}),
  });

  const createFromAction = useMutation(
    orpc.nasaPlanner.posts.createFromAction.mutationOptions({
      onError: () => toast.error("Erro ao criar post a partir do card"),
    }),
  );
  const createBlank = useMutation(
    orpc.nasaPlanner.posts.create.mutationOptions({
      onError: () => toast.error("Erro ao criar post"),
    }),
  );

  const generateImage = useMutation(
    orpc.nasaPlanner.posts.generatePostImage.mutationOptions({
      onSuccess: (data: any) => {
        setGeneratedImageKey(data.imageKey);
        setLastResult({
          modelUsed: data.modelUsed,
          starsSpent: data.starsSpent,
          brandApplied: data.brandApplied,
        });
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts"] });
        toast.success(
          `Imagem gerada via ${data.modelUsed} — ${data.starsSpent}★`,
        );
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Erro ao gerar imagem");
      },
    }),
  );

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
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
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
          const res = (await createFromAction.mutateAsync({
            actionId: actionContext.actionId,
            plannerId,
            type: "STATIC",
          })) as any;
          postId = res.post.id;
        } else {
          // Standalone: cria post em branco
          const res = (await createBlank.mutateAsync({
            plannerId,
            type: "STATIC",
            title: "Novo post",
          } as any)) as any;
          postId = res.post.id;
        }
        if (!postId) return;
        setActivePostId(postId);
      } catch {
        return; // toast já disparado nos onError
      }
    }

    generateImage.mutate({
      postId,
      prompt,
      model,
      aspectRatio,
      referenceImageUrl: referenceUrl || undefined,
      negativePrompt: negativePrompt || undefined,
    });
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
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 px-3 py-2 text-xs">
            <Check className="size-3.5 text-emerald-600 shrink-0" />
            <span>Brand kit aplicado: paleta + fontes da marca</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onBrandingNavigate}
            className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 hover:border-amber-300 dark:hover:border-amber-700 px-3 py-2 text-xs w-full text-left transition"
          >
            <AlertCircle className="size-3.5 text-amber-600 shrink-0" />
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
                      <Loader2 className="size-3.5 animate-spin" />
                      Subindo...
                    </>
                  ) : referenceFileName ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
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
          className="w-full gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
        >
          {creating ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Criando post...
            </>
          ) : generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
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
                <span className="text-emerald-600">✓ Sim</span>
              ) : (
                <span className="text-amber-600">✗ Brand kit incompleto</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Branding Tab ────────────────────────────────────────────────────────────

function BrandingTab() {
  const qc = useQueryClient();
  const { data: brandKit, isLoading } = useQuery({
    ...orpc.brand.getBrandKit.queryOptions({}),
  });

  const update = useMutation(
    orpc.brand.updateBrandKit.mutationOptions({
      onSuccess: () => {
        toast.success("Brand kit atualizado!");
        qc.invalidateQueries({ queryKey: ["brand"] });
      },
      onError: () => toast.error("Erro ao salvar brand kit"),
    }),
  );

  const extractFromLogo = useMutation(
    orpc.brand.extractFromLogo.mutationOptions({
      onSuccess: () => {
        toast.success(
          "Brand kit extraído do logo! Revise os campos abaixo se quiser ajustar.",
        );
        qc.invalidateQueries({ queryKey: ["brand"] });
      },
      onError: (err: any) =>
        toast.error(err?.message ?? "Erro ao extrair brand kit do logo"),
    }),
  );

  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
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
      if (!res.ok) throw new Error("Erro ao obter URL de upload");
      const { presignedUrl, key } = await res.json();
      await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      // Dispara extração automática via Claude Vision (5★)
      await extractFromLogo.mutateAsync({ logoFileKey: key, persist: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload do logo");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const palette: string[] = (brandKit?.paletteHex as string[] | null) ?? [];
  const fontHeading = brandKit?.fontHeading ?? "";
  const fontBody = brandKit?.fontBody ?? "";
  const slogan = brandKit?.slogan ?? "";
  const voiceTone = brandKit?.voiceTone ?? "";
  const logoUrl = brandKit?.logoUrl ?? null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200/60 px-4 py-3 text-xs">
        <p className="font-semibold text-violet-700 dark:text-violet-300 mb-1">
          O que é o brand kit?
        </p>
        <p className="text-violet-900/70 dark:text-violet-200/70 leading-relaxed">
          A paleta, fontes, slogan e tom de voz cadastrados aqui são
          injetados <strong>automaticamente</strong> em toda geração de
          imagem e texto pelo Planner. Garante consistência visual em
          todos os posts.
        </p>
      </div>

      {/* ── Configuração de IA inline (sem precisar ir em Integrações) ── */}
      <AIConfigSection />

      {/* ── Upload de logo + extração automática ── */}
      <div className="space-y-2">
        <Label>Logo da marca</Label>
        <div className="flex items-start gap-4 flex-wrap">
          {logoUrl ? (
            <div className="rounded-lg border w-24 h-24 sm:w-32 sm:h-32 overflow-hidden bg-muted flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveR2Url(logoUrl)}
                alt="Logo"
                className="w-full h-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed w-24 h-24 sm:w-32 sm:h-32 bg-muted/30 flex items-center justify-center text-muted-foreground">
              <ImageIcon className="size-8 opacity-40" />
            </div>
          )}
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="cursor-pointer inline-block">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = "";
                }}
                disabled={uploadingLogo || extractFromLogo.isPending}
              />
              <div className="inline-flex items-center gap-2 rounded-md bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-medium px-3 py-2 transition">
                {uploadingLogo || extractFromLogo.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {uploadingLogo ? "Subindo logo..." : "Extraindo com IA..."}
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    {logoUrl ? "Trocar logo" : "Enviar logo"}
                  </>
                )}
              </div>
            </label>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Ao enviar, a IA <strong>Claude Vision</strong> analisa o logo
              e preenche automaticamente paleta, fontes sugeridas e mood
              (5★ debitados). Você pode editar tudo depois.
            </p>
          </div>
        </div>
      </div>

      {/* ── Paleta ── */}
      <div className="space-y-2">
        <Label>Paleta de cores</Label>
        <PaletteEditor
          colors={palette}
          onChange={(colors) => update.mutate({ paletteHex: colors })}
          saving={update.isPending}
        />
      </div>

      {/* ── Fontes + textos da marca ── */}
      <BrandQuickForm
        initial={{ fontHeading, fontBody, slogan, voiceTone }}
        onSave={(values) => update.mutate(values)}
        saving={update.isPending}
      />
    </div>
  );
}

// ─── AI Config inline ───────────────────────────────────────────────────────
//
// Permite o usuário colar chaves de Anthropic + Ideogram direto na aba
// Branding, sem precisar ir em Settings → Integrações. Salva via
// `platformIntegrations.upsert` (Anthropic, com fallback para campo
// específico do Planner). Pra Ideogram, por enquanto, mostramos uma
// nota informando que precisa ir no Settings (o enum IntegrationPlatform
// não tem IDEOGRAM ainda — será adicionado quando habilitarmos Ideogram
// em produção).

interface IntegrationStatus {
  platform: string;
  isActive: boolean;
}

function AIConfigSection() {
  const qc = useQueryClient();
  const { data: integrations, isLoading } = useQuery({
    ...orpc.platformIntegrations.getMany.queryOptions({}),
  });

  const anthropicConfigured = (integrations as IntegrationStatus[] | undefined)?.some(
    (i) => i.platform === "ANTHROPIC" && i.isActive,
  );

  const upsert = useMutation(
    orpc.platformIntegrations.upsert.mutationOptions({
      onSuccess: () => {
        toast.success("Chave de IA salva!");
        qc.invalidateQueries({
          queryKey: orpc.platformIntegrations.getMany.key({}),
        });
        qc.invalidateQueries({ queryKey: ["brand"] });
      },
      onError: (e: any) =>
        toast.error("Erro ao salvar chave: " + (e?.message ?? "tente novamente")),
    }),
  );

  const [anthropicKey, setAnthropicKey] = useState("");
  const [showAnthropicForm, setShowAnthropicForm] = useState(false);

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" />
          <h3 className="font-semibold text-sm">Configuração de IA</h3>
        </div>
        {anthropicConfigured ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="size-3" /> IA ativa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="size-3" /> Não configurada
          </span>
        )}
      </div>

      {!anthropicConfigured && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          A IA (Claude) é usada pra extrair brand kit do logo, gerar resumos
          e textos brandeados. Sem ela, geração de imagem ainda funciona
          via fallback (DALL-E / Pollinations), mas a extração automática do
          logo fica indisponível.
        </p>
      )}

      {!showAnthropicForm ? (
        <Button
          size="sm"
          variant={anthropicConfigured ? "outline" : "default"}
          onClick={() => setShowAnthropicForm(true)}
          className="gap-2"
        >
          <Sparkles className="size-3.5" />
          {anthropicConfigured ? "Atualizar chave Anthropic" : "Configurar IA agora"}
        </Button>
      ) : (
        <div className="space-y-2 rounded-md bg-muted/40 p-3">
          <Label htmlFor="anthropic-key" className="text-xs">
            Chave da API Anthropic
          </Label>
          <Input
            id="anthropic-key"
            type="password"
            placeholder="sk-ant-..."
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Cole sua chave da{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline font-medium"
            >
              Anthropic Console
            </a>
            . A chave fica salva criptografada apenas pra sua organização —
            nunca exibida na UI depois (campo password). Você pode trocar a
            qualquer momento.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (!anthropicKey.trim()) {
                  toast.error("Cole a chave Anthropic antes de salvar");
                  return;
                }
                upsert.mutate(
                  {
                    platform: "ANTHROPIC" as never,
                    config: { apiKey: anthropicKey.trim() },
                    isActive: true,
                  },
                  {
                    onSuccess: () => {
                      setAnthropicKey("");
                      setShowAnthropicForm(false);
                    },
                  },
                );
              }}
              disabled={upsert.isPending}
              className="gap-2"
            >
              {upsert.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAnthropicForm(false);
                setAnthropicKey("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Ideogram: instrução enxuta (env var por enquanto) */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Configurar Ideogram (gerador de imagens premium)
        </summary>
        <div className="mt-2 rounded-md bg-muted/40 p-3 space-y-2">
          <p className="text-[11px] leading-relaxed">
            O Ideogram 3.0 é o melhor modelo pra cards com tipografia legível
            (estilo Dra. Thaine). Por enquanto, a chave global é configurada
            via env var <code className="bg-background px-1 rounded">IDEOGRAM_API_KEY</code>
            {" "}no servidor. Sem isso, a UI cai pra DALL-E / Pollinations
            automaticamente — você não precisa fazer nada se quiser usar só
            esses providers.
          </p>
          <p className="text-[11px] leading-relaxed">
            Pegue uma chave grátis em{" "}
            <a
              href="https://ideogram.ai/manage-api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline font-medium"
            >
              ideogram.ai/manage-api
            </a>
            {" "}e adicione no seu <code className="bg-background px-1 rounded">.env.local</code>.
            Suporte a chave por-org via UI chega numa sprint futura.
          </p>
        </div>
      </details>
    </div>
  );
}

function PaletteEditor({
  colors,
  onChange,
  saving,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState<string[]>(colors);
  useEffect(() => {
    setLocal(colors);
  }, [colors.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateColor = (i: number, value: string) => {
    const next = [...local];
    next[i] = value;
    setLocal(next);
  };

  const addColor = () => {
    if (local.length >= 8) return;
    setLocal([...local, "#000000"]);
  };

  const removeColor = (i: number) => {
    setLocal(local.filter((_, idx) => idx !== i));
  };

  const hasChanges =
    local.length !== colors.length || local.some((c, i) => c !== colors[i]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {local.map((color, i) => (
          <div
            key={i}
            className="rounded-lg border p-1.5 flex flex-col items-center gap-1 group"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(i, e.target.value)}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded cursor-pointer border-0 p-0"
              style={{ background: color }}
            />
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={color.toUpperCase()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateColor(i, v);
                }}
                className="text-[10px] font-mono w-16 text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-violet-500 rounded"
              />
              <button
                type="button"
                onClick={() => removeColor(i)}
                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                aria-label="Remover cor"
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        ))}
        {local.length < 8 && (
          <button
            type="button"
            onClick={addColor}
            className="rounded-lg border border-dashed w-[88px] sm:w-[120px] h-[88px] sm:h-[104px] hover:bg-muted/40 text-muted-foreground text-xs transition"
          >
            + cor
          </button>
        )}
      </div>
      {hasChanges && (
        <Button
          size="sm"
          onClick={() => onChange(local)}
          disabled={saving}
          className="gap-2"
        >
          {saving ? "Salvando..." : "Salvar paleta"}
        </Button>
      )}
    </div>
  );
}

function BrandQuickForm({
  initial,
  onSave,
  saving,
}: {
  initial: {
    fontHeading: string;
    fontBody: string;
    slogan: string;
    voiceTone: string;
  };
  onSave: (values: typeof initial) => void;
  saving: boolean;
}) {
  const [fontHeading, setFontHeading] = useState(initial.fontHeading);
  const [fontBody, setFontBody] = useState(initial.fontBody);
  const [slogan, setSlogan] = useState(initial.slogan);
  const [voiceTone, setVoiceTone] = useState(initial.voiceTone);

  // Atualiza locais quando a server query atualiza (ex: após extractFromLogo)
  useEffect(() => {
    setFontHeading(initial.fontHeading);
    setFontBody(initial.fontBody);
    setSlogan(initial.slogan);
    setVoiceTone(initial.voiceTone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial.fontHeading,
    initial.fontBody,
    initial.slogan,
    initial.voiceTone,
  ]);

  // Google Fonts autocomplete
  const [fontQuery, setFontQuery] = useState("");
  const { data: fontResults } = useQuery({
    ...orpc.brand.searchGoogleFonts.queryOptions({
      input: { query: fontQuery, limit: 8 },
    }),
    enabled: fontQuery.length >= 2,
  });
  const fontSuggestions = fontResults?.fonts ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="fh" className="text-xs">
            Fonte heading
          </Label>
          <Input
            id="fh"
            placeholder="Ex: Playfair Display"
            value={fontHeading}
            onChange={(e) => {
              setFontHeading(e.target.value);
              setFontQuery(e.target.value);
            }}
            onBlur={() => setTimeout(() => setFontQuery(""), 200)}
          />
          {fontQuery.length >= 2 && fontSuggestions.length > 0 && (
            <div className="rounded-md border bg-popover shadow-md max-h-40 overflow-y-auto text-xs">
              {fontSuggestions.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  onClick={() => {
                    setFontHeading(f.family);
                    setFontQuery("");
                  }}
                  className="w-full text-left px-2 py-1.5 hover:bg-accent"
                >
                  <span className="font-medium">{f.family}</span>
                  <span className="text-muted-foreground ml-2">{f.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="fb" className="text-xs">
            Fonte body
          </Label>
          <Input
            id="fb"
            placeholder="Ex: Inter"
            value={fontBody}
            onChange={(e) => setFontBody(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="slogan" className="text-xs">
          Slogan / nome da marca
        </Label>
        <Input
          id="slogan"
          placeholder="Ex: Dra. Thaine Malinowski — Harmonização Corporal"
          value={slogan}
          onChange={(e) => setSlogan(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="voice" className="text-xs">
          Tom de voz
        </Label>
        <Textarea
          id="voice"
          placeholder="Ex: Elegante, profissional, científico mas acessível."
          value={voiceTone}
          onChange={(e) => setVoiceTone(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>
      <Button
        size="sm"
        onClick={() => onSave({ fontHeading, fontBody, slogan, voiceTone })}
        disabled={saving}
      >
        {saving ? "Salvando..." : "Salvar marca"}
      </Button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PlaceholderTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
      <div className="opacity-40 mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-xs max-w-md leading-relaxed">{description}</p>
    </div>
  );
}

function resolveR2Url(key: string): string {
  if (/^https?:\/\//i.test(key)) return key;
  const publicUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
  if (publicUrl) return `${publicUrl}/${key}`;
  if (bucket) return `https://${bucket}.r2.dev/${key}`;
  return key;
}
