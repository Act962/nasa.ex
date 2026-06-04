"use client";

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
import type { ElementBase, PageIntent } from "../../types";
import {
  PAGE_TEMPLATES,
  applyTemplate,
  type PageTemplate,
} from "../../lib/page-templates";

export function PageTemplatesGallery() {
  const router = useRouter();
  const qc = useQueryClient();

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
      toast.success("Site criado com modelo da plataforma");
      qc.invalidateQueries({ queryKey: orpc.pages.listPages.queryKey() });
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
              className="flex flex-col group hover:border-violet-400 transition-colors"
            >
              {/* Thumbnail gerado a partir dos tokens do template */}
              <div
                className="relative h-32 rounded-t-xl overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${t.tokens.primary}40 0%, ${t.tokens.accent}20 100%)`,
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-70">
                  {t.category === "Sales" && "💼"}
                  {t.category === "Eventos" && "🎉"}
                  {t.category === "Pessoal" && "👤"}
                  {t.category === "Comunidade" && "👥"}
                </div>
                <span
                  className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: t.tokens.bg,
                    color: t.tokens.primary,
                    border: `1px solid ${t.tokens.primary}40`,
                  }}
                >
                  {t.category}
                </span>
                <span className="absolute top-2 right-2 text-[10px] font-mono text-white/90 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full">
                  {t.elements.length} blocos
                </span>
              </div>
              <CardContent className="p-4 flex-1 flex flex-col gap-2.5">
                <h3 className="font-semibold leading-tight text-sm">
                  {t.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                  {t.description}
                </p>
                <Button
                  className="mt-auto gap-1.5"
                  onClick={() => useCodeTemplate(t)}
                  disabled={isApplyingCode}
                >
                  <Copy className="size-3.5" />
                  Usar este modelo (2.000 ★)
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
    </div>
  );
}
