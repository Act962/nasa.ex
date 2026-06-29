"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc, client } from "@/lib/orpc";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Layers, Layers2, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { INTENT_LABELS } from "../../constants";
import { STARS_COST } from "../../constants";
import type { ElementBase, PageIntent } from "../../types";
import {
  PAGE_TEMPLATES,
  applyTemplate,
  type PageTemplate,
} from "../../lib/page-templates";
import { TemplatePreviewDialog } from "../template-preview-dialog";
import { ElementRenderer } from "../elements/element-renderer";
import { isFlowSection } from "../../lib/section-flow";
import type { ElementType } from "../../types";

export function PageTemplatesGallery() {
  const router = useRouter();
  const qc = useQueryClient();
  // State pro dialog de preview — passo extra antes de debitar Stars.
  const [previewTemplate, setPreviewTemplate] = useState<PageTemplate | null>(null);

  const { data, isLoading } = useQuery({
    ...orpc.pages.listTemplates.queryOptions({ input: {} }),
    staleTime: 30_000,
  });

  const { mutate: use, isPending } = useMutation({
    mutationFn: (t: { id: string; title: string; slug: string }) => {
      const suffix = Math.random().toString(36).slice(2, 7);
      return client.pages.duplicatePage({
        id: t.id,
        newSlug: `${t.slug}-${suffix}`,
        newTitle: `${t.title} (cópia)`,
      });
    },
    onSuccess: (res) => {
      toast.success("Site criado a partir do template");
      qc.invalidateQueries({ queryKey: orpc.pages.listPages.queryKey() });
      router.push(`/pages/${res.page.id}`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao usar template"),
  });

  /**
   * Aplica um template **de código** (PAGE_TEMPLATES em lib/) — diferente
   * dos templates do banco que são duplicação de pages existentes.
   * Pipeline: createPage vazio → updatePage injetando layout com os
   * elements do template aplicado.
   */
  const { mutate: useCodeTemplate, isPending: isApplyingCode } = useMutation({
    mutationFn: async (template: PageTemplate) => {
      const applied = applyTemplate(template.id);
      if (!applied) throw new Error("Template inválido");

      // 1) Cria page vazia com palette do template
      const res = await client.pages.createPage({
        title: template.name,
        slug: `${template.id}-${Math.random().toString(36).slice(2, 7)}`,
        description: template.description,
        intent: template.intent,
        layerCount: 1,
        palette: {
          primary: template.tokens.primary,
          accent: template.tokens.accent,
          bg: template.tokens.bg,
          fg: template.tokens.fg,
          muted: template.tokens.muted,
        },
      });

      // 2) Injeta layout com elements do template
      const totalH = applied.elements.reduce(
        (acc, el) => Math.max(acc, (el.y ?? 0) + (el.h ?? 0)),
        0,
      );
      await client.pages.updatePage({
        id: res.page.id,
        layout: {
          mode: "single",
          main: { elements: applied.elements as ElementBase[] },
          artboard: { width: 1200, minHeight: Math.max(800, totalH) },
          tokens: { colors: applied.tokens },
        },
      });

      return res;
    },
    onSuccess: (res) => {
      toast.success("🚀 Sua landing decolou!");
      qc.invalidateQueries({ queryKey: orpc.pages.listPages.queryKey() });
      setPreviewTemplate(null);
      router.push(`/pages/${res.page.id}`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao usar template"),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/pages">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="size-6 text-indigo-500" />
            Templates NASA Pages
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comece com um site pronto e personalize como quiser.
          </p>
        </div>
      </header>

      {/* ── Importar de URL externa ───────────────────────────── */}
      <CloneFromUrlSection />

      {/* ── Templates da PLATAFORMA (código) ────────────────────
          Sempre disponíveis. Vêm de `lib/page-templates.ts`. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold flex items-center gap-1.5">
            <Zap className="size-4 text-violet-500" />
            Templates da plataforma
          </h2>
          <span className="text-xs text-muted-foreground">
            {PAGE_TEMPLATES.length} modelos prontos
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAGE_TEMPLATES.map((t) => (
            <Card
              key={t.id}
              className="relative flex flex-col group hover:border-violet-400 transition-colors overflow-hidden"
            >
              {/* Thumbnail = MINI-PREVIEW REAL do template (scale 0.18). */}
              <TemplateMiniPreview template={t} />
              <span
                className="absolute top-2 left-2 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: t.tokens.bg,
                  color: t.tokens.primary,
                  border: `1px solid ${t.tokens.primary}40`,
                }}
              >
                {t.category}
              </span>
              <span className="absolute top-2 right-2 z-10 text-[10px] font-mono text-white/90 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                {t.elements.length} blocos
              </span>
              <CardContent className="p-4 flex-1 flex flex-col gap-2.5">
                <h3 className="font-semibold leading-tight text-sm">
                  {t.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                  {t.description}
                </p>
                <Button
                  className="mt-auto gap-1.5"
                  onClick={() => setPreviewTemplate(t)}
                  disabled={isApplyingCode}
                >
                  <Sparkles className="size-3.5" />
                  Pré-visualizar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Templates do BANCO (pages duplicadas marcadas como template) ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold flex items-center gap-1.5">
            <Sparkles className="size-4 text-indigo-500" />
            Templates da comunidade
          </h2>
          <span className="text-xs text-muted-foreground">
            Páginas marcadas como template pela equipe NASA
          </span>
        </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando templates…</div>
      ) : !data?.templates?.length ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Sparkles className="size-8 text-muted-foreground" />
            <p className="font-medium">Nenhum template disponível ainda</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Templates são criados pela equipe NASA e aparecem aqui quando aprovados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.templates.map((t) => (
            <Card key={t.id} className="flex flex-col group hover:border-indigo-400 transition-colors">
              {t.ogImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.ogImageUrl}
                  alt={t.title}
                  className="w-full h-40 object-cover rounded-t-xl"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-t-xl flex items-center justify-center">
                  <Sparkles className="size-10 text-indigo-300" />
                </div>
              )}
              <CardContent className="p-4 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{t.title}</h3>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {INTENT_LABELS[t.intent as PageIntent]}
                  </Badge>
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {t.layerCount === 2 ? (
                    <><Layers2 className="size-3.5" /> 2 camadas (parallax)</>
                  ) : (
                    <><Layers className="size-3.5" /> 1 camada</>
                  )}
                  {t.templateCategory && (
                    <Badge variant="outline" className="text-[10px] ml-auto">{t.templateCategory}</Badge>
                  )}
                </div>
                <Button
                  className="mt-auto gap-1.5"
                  onClick={() => use({ id: t.id, title: t.title, slug: t.slug })}
                  disabled={isPending}
                >
                  <Copy className="size-3.5" />
                  Usar template (2.000 ★)
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </section>

      {/* Dialog de preview — aparece quando user clica "Pré-visualizar".
          Mostra o template renderizado + botão "Criar landing page"
          que dispara a mutation real. Durante a aplicação mostra o
          RocketLoader. */}
      <TemplatePreviewDialog
        open={!!previewTemplate}
        onOpenChange={(o) => !o && setPreviewTemplate(null)}
        template={previewTemplate}
        isApplying={isApplyingCode}
        costStars={STARS_COST}
        onConfirm={() => {
          if (previewTemplate) useCodeTemplate(previewTemplate);
        }}
      />
    </div>
  );
}

// ─── CloneFromUrlSection ────────────────────────────────────────
// Bloco no topo da galeria que permite ao user colar uma URL e
// criar uma page semelhante. O servidor faz scrape, monta blocos
// e cria a page nova num pipeline createPage + updatePage.

function CloneFromUrlSection() {
  const router = useRouter();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  // Ref pra capturar stats da fase 1 (clone) e ler em onSuccess
  // (que só recebe o res da fase 2/3). Avoid recriar a promise toda.
  const lastScrapeStats = useRef<{
    blocksGenerated: number;
    faqs: number;
    testimonials: number;
    pricing: number;
    imagesFound: number;
  } | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      // 1) Server faz scrape e retorna elements + tokens
      const scraped = await client.pages.cloneFromUrl({ url });
      lastScrapeStats.current = scraped.stats;

      // 2) Cria a page com palette do scrape
      const res = await client.pages.createPage({
        title: scraped.title.slice(0, 80),
        slug: `import-${Math.random().toString(36).slice(2, 8)}`,
        description: scraped.description || undefined,
        intent: "LANDING",
        layerCount: 1,
        palette: scraped.tokens.colors,
      });

      // 3) Injeta layout com elements gerados
      const totalH = scraped.elements.reduce(
        (acc: number, el: { y?: number; h?: number }) =>
          Math.max(acc, (el.y ?? 0) + (el.h ?? 0)),
        0,
      );
      await client.pages.updatePage({
        id: res.page.id,
        layout: {
          mode: "single",
          main: { elements: scraped.elements as ElementBase[] },
          artboard: { width: 1200, minHeight: Math.max(800, totalH) },
          tokens: scraped.tokens,
        },
      });

      return res;
    },
    onSuccess: (res) => {
      // Pega stats do scraped através do prefetched cache da mutation.
      // Como a mutation faz 3 chamadas (clone+create+update) e só
      // retorna o último res (createPage), uso o ref `lastScrapeStats`
      // que armazenei no escopo da mutationFn.
      const s = lastScrapeStats.current;
      const summary = s
        ? `${s.blocksGenerated} blocos · ${s.faqs} FAQ · ${s.testimonials} depoimentos · ${s.pricing} planos · ${s.imagesFound} imagens`
        : "Página importada";
      toast.success(`🚀 ${summary}. Edite no builder.`);
      qc.invalidateQueries({ queryKey: orpc.pages.listPages.queryKey() });
      setUrl("");
      router.push(`/pages/${res.page.id}`);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Erro ao importar página"),
  });

  return (
    <section className="rounded-2xl border border-dashed border-violet-500/40 bg-violet-500/5 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-violet-500" />
        <h2 className="text-base font-bold">Criar página semelhante</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Cole a URL de um site público que você gostou. A NASA vai tentar
        replicar a estrutura visual (títulos, blocos, cores). Você edita o
        resultado no builder.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!url.trim()) return;
          mutate();
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <input
          type="url"
          required
          placeholder="https://exemplo.com/minha-pagina"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
          disabled={isPending}
        />
        <Button
          type="submit"
          disabled={!url.trim() || isPending}
          className="gap-1.5 whitespace-nowrap"
        >
          {isPending ? "Importando…" : "Importar e criar (2.000 ★)"}
        </Button>
      </form>
      <p className="text-[10px] text-muted-foreground mt-2 italic">
        Funciona melhor com sites estáticos. SPAs/cloudflare podem não
        retornar conteúdo completo.
      </p>
    </section>
  );
}

/**
 * Mini-preview do template renderizado dentro do card de seleção.
 * Renderiza os 3 primeiros blocos do template em escala 18% pra caber
 * num thumbnail de 128px de altura. Mostra preview real, não emoji.
 *
 * `pointer-events-none` no wrapper pra clicks atravessarem direto pro
 * botão "Pré-visualizar" abaixo (o card inteiro vira clicável).
 */
function TemplateMiniPreview({ template }: { template: PageTemplate }) {
  const applied = applyTemplate(template.id);
  const elements = applied?.elements ?? [];
  const flowElements = elements
    .filter((el) => isFlowSection(el.type as ElementType))
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
    .slice(0, 8); // Até 8 primeiros blocos (cabe mais com altura dobrada)

  // SCALE = 0.30 mostra 360px de largura visual (cabe nos cards de
  // ~350px) e até ~853px de altura original na div de 256px.
  // transform-origin no centro pra que blocos full-width fiquem
  // visualmente centralizados quando cards forem mais largos.
  const SCALE = 0.3;

  return (
    <div
      className="relative h-64 overflow-hidden border-b pointer-events-none"
      style={{ background: template.tokens.bg }}
    >
      {/* Fallback: gradient com cor do template caso não tenha blocos */}
      {flowElements.length === 0 ? (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${template.tokens.primary}40 0%, ${template.tokens.accent}20 100%)`,
          }}
        />
      ) : (
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
            width: 1280,
          }}
        >
          {flowElements.map((el, idx) => (
            <div key={el.id ?? idx} className="w-full">
              <ElementRenderer
                element={el}
                readonly
                tokens={
                  applied ? { colors: applied.tokens } : undefined
                }
              />
            </div>
          ))}
        </div>
      )}

      {/* Overlay sutil pra deixar ler badges em cima */}
      <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/40 to-transparent" />
      {/* Fade no rodapé pra cortar suavemente o conteúdo */}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  );
}
