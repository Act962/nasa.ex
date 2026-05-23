"use client";

/**
 * PlannerPopup — NASA Planner 2.0.
 *
 * Popup ancorado em cards de evento do Workspace (`view-action-modal`)
 * com 4 abas: **Campanhas**, **Posts**, **Mapa Mental**, **Branding**.
 *
 * Substitui o antigo `ActionToPlannerDialog` (que era um seletor simples
 * de Planner + tipo de post). Agora toda a criação de conteúdo acontece
 * dentro deste popup, com:
 *  - Upload/URL de imagem de referência
 *  - Seleção de modelo IA (Ideogram 3.0 Quality/Balanced/Turbo,
 *    DALL-E 3, Pollinations) com STARs visíveis
 *  - Prompt + negative prompt
 *  - Brand kit aplicado automaticamente
 *  - Preview da imagem gerada
 *
 * Quando aberto via "Criar com Planner" no Workspace, recebe
 * `actionContext` com `actionId` + `title` + `description` + anexos —
 * a aba Posts inicia com novo post já pré-preenchido (caption = action
 * description, title = action title).
 */

import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import Image from "next/image";

export interface ActionContext {
  actionId: string;
  title: string;
  description: string | null;
  attachmentUrls: string[];
}

interface PlannerPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Contexto opcional vindo do card de evento do Workspace. Quando
   * presente, o popup abre direto na aba Posts com novo post já
   * criado vinculado ao actionId.
   */
  actionContext?: ActionContext;
  /**
   * Planner em que o conteúdo será criado. Se omitido, usa o primeiro
   * Planner da org (criando um padrão se não houver).
   */
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
  best: "typography" | "realism" | "fast" | "free";
}

const MODEL_CATALOG: ModelInfo[] = [
  {
    value: "ideogram_quality",
    label: "Ideogram 3.0 Quality",
    stars: 6,
    hint: "Melhor pra cards com TIPOGRAFIA legível. Recomendado pra publicação.",
    best: "typography",
  },
  {
    value: "ideogram_balanced",
    label: "Ideogram 3.0 Balanced",
    stars: 4,
    hint: "Padrão — bom custo-benefício pra iteração.",
    best: "typography",
  },
  {
    value: "ideogram_turbo",
    label: "Ideogram 3.0 Turbo",
    stars: 3,
    hint: "Rápido (~5s). Bom pra brainstorming.",
    best: "fast",
  },
  {
    value: "dalle3_hd",
    label: "DALL-E 3 HD",
    stars: 5,
    hint: "Bom pra fotos/cenas realistas. Tipografia inconsistente.",
    best: "realism",
  },
  {
    value: "dalle3_standard",
    label: "DALL-E 3 Standard",
    stars: 3,
    hint: "Fallback OK quando Ideogram não disponível.",
    best: "realism",
  },
  {
    value: "pollinations",
    label: "Pollinations (gratuito)",
    stars: 1,
    hint: "Grátis, qualidade inconsistente. Último recurso.",
    best: "free",
  },
];

export function PlannerPopup({
  open,
  onOpenChange,
  actionContext,
  initialPlannerId,
}: PlannerPopupProps) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"campaigns" | "posts" | "mindmap" | "branding">(
    actionContext ? "posts" : "campaigns",
  );
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const { data: plannersData } = useQuery({
    ...orpc.nasaPlanner.planners.list.queryOptions({}),
    enabled: open,
  });
  const planners = plannersData?.planners ?? [];
  const plannerId =
    initialPlannerId ?? planners[0]?.id ?? null;

  // Cria post automaticamente quando o popup abre via "Criar com Planner"
  // do card de evento — usa o procedure existente `createPostFromAction`
  // (que já copia title + description + actionId — sprint foundation).
  const createFromAction = useMutation(
    orpc.nasaPlanner.posts.createFromAction.mutationOptions({
      onSuccess: (data: any) => {
        setActivePostId(data.post.id);
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
        toast.success("Post criado a partir do card!");
      },
      onError: () => toast.error("Erro ao criar post"),
    }),
  );

  useEffect(() => {
    if (open && actionContext && plannerId && !activePostId) {
      createFromAction.mutate({
        actionId: actionContext.actionId,
        plannerId,
        type: "STATIC",
      });
    }
  }, [open, actionContext?.actionId, plannerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-violet-500" />
            NASA Planner
            {actionContext && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — vinculado a "{actionContext.title}"
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-6 grid grid-cols-4 w-auto">
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="size-3.5" /> Campanhas
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-1.5">
              <FileText className="size-3.5" /> Posts
            </TabsTrigger>
            <TabsTrigger value="mindmap" className="gap-1.5">
              <Brain className="size-3.5" /> Mapa Mental
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-1.5">
              <Palette className="size-3.5" /> Branding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="flex-1 overflow-y-auto px-6 py-4">
            {plannerId ? (
              <PostsTab
                plannerId={plannerId}
                postId={activePostId}
                actionContext={actionContext}
                onPostCreated={setActivePostId}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Carregando planner...
              </p>
            )}
          </TabsContent>

          <TabsContent value="campaigns" className="flex-1 overflow-y-auto px-6 py-4">
            <PlaceholderTab
              icon={<Megaphone className="size-8" />}
              title="Campanhas"
              description="Wizard 5W2H + gestão de campanhas. (Reusa CampaignsTab da página standalone — refator em andamento, próximo PR.)"
            />
          </TabsContent>

          <TabsContent value="mindmap" className="flex-1 overflow-y-auto px-6 py-4">
            <PlaceholderTab
              icon={<Brain className="size-8" />}
              title="Mapa Mental"
              description="Brainstorm visual de ideias pra campanha. (Reusa MindMapsTab — refator em andamento.)"
            />
          </TabsContent>

          <TabsContent value="branding" className="flex-1 overflow-y-auto px-6 py-4">
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
  postId: string | null;
  actionContext?: ActionContext;
  onPostCreated: (id: string) => void;
}

function PostsTab({
  plannerId,
  postId,
  actionContext,
  onPostCreated,
}: PostsTabProps) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("ideogram_balanced");
  const [aspectRatio, setAspectRatio] = useState<
    "1x1" | "9x16" | "16x9" | "4x5" | "5x4"
  >("1x1");
  const [referenceMode, setReferenceMode] = useState<"upload" | "url">("url");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [generatedImageKey, setGeneratedImageKey] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    modelUsed: string;
    starsSpent: number;
    brandApplied: boolean;
  } | null>(null);

  // Sugere primeiro anexo do card como referência (se houver)
  useEffect(() => {
    if (actionContext?.attachmentUrls?.[0] && !referenceUrl) {
      setReferenceUrl(actionContext.attachmentUrls[0]);
    }
  }, [actionContext?.attachmentUrls]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brand kit pro indicador
  const { data: brandKit } = useQuery({
    ...orpc.brand.getBrandKit.queryOptions(),
  });

  const createBlankPost = useMutation(
    orpc.nasaPlanner.posts.create.mutationOptions({
      onSuccess: (data: any) => {
        onPostCreated(data.post.id);
        qc.invalidateQueries({ queryKey: ["nasaPlanner", "posts", "getMany"] });
      },
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
        toast.success(`Imagem gerada via ${data.modelUsed} — ${data.starsSpent}★`);
      },
      onError: (err: any) => {
        toast.error(err?.message ?? "Erro ao gerar imagem");
      },
    }),
  );

  const handleGenerate = async () => {
    let effectivePostId = postId;
    if (!effectivePostId) {
      const res = await createBlankPost.mutateAsync({
        plannerId,
        type: "STATIC",
        title: actionContext?.title ?? "Novo post",
      } as any);
      effectivePostId = (res as any).post.id;
    }
    if (!effectivePostId) return;

    generateImage.mutate({
      postId: effectivePostId,
      prompt,
      model,
      aspectRatio,
      referenceImageUrl: referenceUrl || undefined,
      negativePrompt: negativePrompt || undefined,
    });
  };

  const selectedModel = MODEL_CATALOG.find((m) => m.value === model)!;
  const brandKitComplete = brandKit?.kitComplete ?? false;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-6">
      {/* ── Form esquerdo ── */}
      <div className="space-y-4">
        {/* Brand kit indicator */}
        {brandKitComplete ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 px-3 py-2 text-xs">
            <Palette className="size-3.5 text-emerald-600" />
            <span>
              Brand kit aplicado: paleta + fontes da marca serão usadas
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 px-3 py-2 text-xs">
            <AlertCircle className="size-3.5 text-amber-600 shrink-0" />
            <span>
              Brand kit incompleto. Configure paleta + fonte na aba{" "}
              <strong>Branding</strong> pra resultados mais consistentes.
            </span>
          </div>
        )}

        {/* Caption (auto-preenchida se veio do card) */}
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

        {/* Prompt principal */}
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

        {/* Referência: upload ou URL */}
        <div className="space-y-1.5">
          <Label>Imagem de referência (opcional)</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={referenceMode === "url" ? "default" : "outline"}
              onClick={() => setReferenceMode("url")}
              className="gap-1.5"
            >
              <Link2 className="size-3" /> URL
            </Button>
            <Button
              type="button"
              size="sm"
              variant={referenceMode === "upload" ? "default" : "outline"}
              onClick={() => setReferenceMode("upload")}
              className="gap-1.5"
              disabled
              title="Upload chega no próximo PR — por enquanto use URL"
            >
              <Upload className="size-3" /> Upload (em breve)
            </Button>
          </div>
          {referenceMode === "url" && (
            <Input
              placeholder="https://example.com/referencia.jpg"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              type="url"
            />
          )}
          {referenceUrl && (
            <div className="rounded-lg overflow-hidden border w-32 h-32 relative bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={referenceUrl}
                alt="Referência"
                className="w-full h-full object-cover"
                onError={(e) =>
                  ((e.target as HTMLImageElement).style.display = "none")
                }
              />
            </div>
          )}
        </div>

        {/* Modelo IA */}
        <div className="space-y-1.5">
          <Label htmlFor="model">Modelo de IA</Label>
          <Select value={model} onValueChange={(v) => setModel(v as ImageModel)}>
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

        {/* Negative prompt (collapsed) */}
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
          disabled={
            !prompt || prompt.length < 5 || generateImage.isPending || createBlankPost.isPending
          }
          className="w-full gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
        >
          {generateImage.isPending ? (
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
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Preview</Label>
        <div
          className={
            "rounded-xl border bg-muted/30 overflow-hidden flex items-center justify-center " +
            (aspectRatio === "9x16"
              ? "aspect-[9/16] max-w-xs mx-auto"
              : aspectRatio === "16x9"
                ? "aspect-video"
                : aspectRatio === "4x5"
                  ? "aspect-[4/5] max-w-sm mx-auto"
                  : aspectRatio === "5x4"
                    ? "aspect-[5/4]"
                    : "aspect-square max-w-sm mx-auto")
          }
        >
          {generateImage.isPending ? (
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
              <p className="text-xs">
                A imagem aparece aqui após gerar
              </p>
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
                <span className="text-amber-600">
                  ✗ Brand kit incompleto
                </span>
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
    ...orpc.brand.getBrandKit.queryOptions(),
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

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const palette: string[] = (brandKit?.paletteHex as string[] | null) ?? [];
  const fontHeading = brandKit?.fontHeading ?? "";
  const fontBody = brandKit?.fontBody ?? "";
  const slogan = brandKit?.slogan ?? "";
  const voiceTone = brandKit?.voiceTone ?? "";

  return (
    <div className="space-y-6">
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

      {/* Status de completude */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Stat
          label="Logo"
          done={!!brandKit?.logoUrl}
          hint="Upload via aba Branding (UI completa no próximo PR)"
        />
        <Stat label="Paleta" done={palette.length >= 2} hint={`${palette.length} cor(es)`} />
        <Stat label="Fonte heading" done={!!fontHeading} hint={fontHeading || "—"} />
        <Stat label="Fonte body" done={!!fontBody} hint={fontBody || "—"} />
        <Stat label="Slogan" done={!!slogan} hint={slogan || "—"} />
        <Stat label="Tom de voz" done={!!voiceTone} hint={voiceTone || "—"} />
      </div>

      {/* Paleta atual */}
      <div className="space-y-2">
        <Label>Paleta de cores</Label>
        <div className="flex flex-wrap gap-2">
          {palette.length > 0 ? (
            palette.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border w-16 h-16 flex flex-col items-center justify-center text-[10px] font-mono shadow-sm"
                style={{
                  backgroundColor: c,
                  color: pickReadable(c),
                }}
              >
                {c.toUpperCase()}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhuma cor cadastrada ainda.
            </p>
          )}
        </div>
      </div>

      {/* Form de edição rápida */}
      <BrandQuickForm
        initial={{ fontHeading, fontBody, slogan, voiceTone }}
        onSave={(values) => update.mutate(values)}
        saving={update.isPending}
      />

      <p className="text-[10px] text-muted-foreground italic">
        Upload de logo + extração automática via Claude Vision (5★) +
        autocomplete Google Fonts vão chegar no próximo PR. Por enquanto,
        edite manualmente os campos acima.
      </p>
    </div>
  );
}

function Stat({
  label,
  done,
  hint,
}: {
  label: string;
  done: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={
            "size-1.5 rounded-full " + (done ? "bg-emerald-500" : "bg-muted-foreground/40")
          }
        />
        <span className="text-xs font-medium truncate">{label}</span>
      </div>
      <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
        {hint}
      </span>
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="fh" className="text-xs">
            Fonte heading
          </Label>
          <Input
            id="fh"
            placeholder="Ex: Playfair Display"
            value={fontHeading}
            onChange={(e) => setFontHeading(e.target.value)}
          />
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
        onClick={() =>
          onSave({ fontHeading, fontBody, slogan, voiceTone })
        }
        disabled={saving}
      >
        {saving ? "Salvando..." : "Salvar brand kit"}
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
  const publicUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
  if (publicUrl) return `${publicUrl}/${key}`;
  if (bucket) return `https://${bucket}.r2.dev/${key}`;
  return key;
}

/**
 * Decide cor de texto (preto/branco) baseado na luminância do background
 * pra garantir legibilidade. Usado pra mostrar o hex da cor dentro do
 * swatch da paleta.
 */
function pickReadable(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#000";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000" : "#fff";
}
