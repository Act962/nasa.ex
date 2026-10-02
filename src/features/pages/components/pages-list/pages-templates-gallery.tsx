"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Copy, Eye, Layers, Layers2, Sparkles, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { INTENT_LABELS, STARS_COST } from "../../constants";
import type { PageIntent } from "../../types";
import { PAGE_TEMPLATES, type PageTemplate } from "../../lib/page-templates";
import {
  useCreatePageFromCodeTemplate,
  useDuplicateTemplatePage,
  useListPageTemplates,
} from "../../hooks/use-page-templates";
import { usePagesOrbitDock } from "../../hooks/use-pages-orbit-dock";
import { TemplatePreviewDialog } from "../template-preview-dialog";
import { CreatePageWizard } from "../wizard/create-page-wizard";
import { CloneFromUrlSection } from "./clone-from-url-section";
import { TemplateMiniPreview } from "./template-mini-preview";

export function PageTemplatesGallery() {
  const router = useRouter();
  const [previewTemplate, setPreviewTemplate] = useState<PageTemplate | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const { data, isLoading } = useListPageTemplates();
  const { mutate: duplicateTemplatePage, isPending: isDuplicating } = useDuplicateTemplatePage();
  const { mutate: createPageFromCodeTemplate, isPending: isApplyingCodeTemplate } = useCreatePageFromCodeTemplate();

  usePagesOrbitDock({ activeSection: "templates", onCreateSite: () => setIsWizardOpen(true) });

  const applyCommunityTemplate = (template: { id: string; title: string; slug: string }) => {
    duplicateTemplatePage(template, {
      onSuccess: (result) => {
        toast.success("Site criado a partir do template");
        router.push(`/pages/${result.page.id}`);
      },
      onError: (error: Error) => toast.error(error.message ?? "Erro ao usar template"),
    });
  };

  const confirmCodeTemplate = () => {
    if (!previewTemplate) return;
    createPageFromCodeTemplate(previewTemplate, {
      onSuccess: (result) => {
        toast.success("Sua landing page está pronta para editar");
        setPreviewTemplate(null);
        router.push(`/pages/${result.page.id}`);
      },
      onError: (error: Error) => toast.error(error.message ?? "Erro ao usar template"),
    });
  };

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <header className="flex min-w-0 items-center gap-2.5">
        <Button
          asChild
          size="icon"
          variant="ghost"
          className="size-10 shrink-0 rounded-full bg-knob"
          aria-label="Voltar para os sites"
          title="Voltar para os sites"
        >
          <Link href="/pages">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15 max-md:hidden">
          <Sparkles className="size-5 text-info" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:text-2xl">Templates</h1>
          <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">
            Comece com um site pronto e personalize do seu jeito.
          </p>
        </div>
      </header>

      <CloneFromUrlSection costStars={STARS_COST} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="flex items-center gap-1.5 text-base font-bold">
            <Zap className="size-4 text-info" />
            Templates da plataforma
          </h2>
          <span className="text-xs text-muted-foreground">{PAGE_TEMPLATES.length} modelos prontos</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {PAGE_TEMPLATES.map((template) => (
            <article key={template.id} className="flex min-w-0 flex-col gap-2">
              <button
                type="button"
                onClick={() => setPreviewTemplate(template)}
                disabled={isApplyingCodeTemplate}
                className="relative block overflow-hidden rounded-[18px] border border-line text-left transition-colors hover:border-info/60"
                aria-label={`Ver o template ${template.name}`}
              >
                <TemplateMiniPreview template={template} />
                <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-sm">
                  {template.category}
                </span>
                <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur-sm">
                  <Eye className="size-3" />
                  Ver
                </span>
              </button>
              <div className="min-w-0 px-1">
                <h3 className="truncate text-sm font-semibold">{template.name}</h3>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{template.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="flex items-center gap-1.5 text-base font-bold">
            <Users className="size-4 text-info" />
            Templates da comunidade
          </h2>
          <span className="text-xs text-muted-foreground">Páginas escolhidas pela equipe ÓRBITA</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <OrbitaSpinner className="size-7" />
          </div>
        ) : !data?.templates?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-6 py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum template da comunidade ainda</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Eles aparecem aqui quando a equipe ÓRBITA aprova novos modelos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
            {data.templates.map((template) => (
              <article
                key={template.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-line bg-card"
              >
                {template.ogImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={template.ogImageUrl} alt={template.title} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-info/10">
                    <Sparkles className="size-8 text-info/50" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h3 className="truncate text-sm leading-tight font-semibold">{template.title}</h3>
                    <Badge variant="secondary" className="shrink-0 rounded-full text-[10px] max-md:hidden">
                      {INTENT_LABELS[template.intent as PageIntent]}
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{template.description}</p>
                  )}
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {template.layerCount === 2 ? <Layers2 className="size-3.5" /> : <Layers className="size-3.5" />}
                    {template.layerCount === 2 ? "2 camadas" : "1 camada"}
                  </span>
                  <Button
                    className="mt-auto h-10 gap-1.5 rounded-full"
                    onClick={() => applyCommunityTemplate({ id: template.id, title: template.title, slug: template.slug })}
                    disabled={isDuplicating}
                  >
                    <Copy className="size-3.5" />
                    <span className="truncate">Usar ({STARS_COST.toLocaleString("pt-BR")} Stars)</span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <TemplatePreviewDialog
        open={!!previewTemplate}
        onOpenChange={(isOpen) => !isOpen && setPreviewTemplate(null)}
        template={previewTemplate}
        isApplying={isApplyingCodeTemplate}
        costStars={STARS_COST}
        onConfirm={confirmCodeTemplate}
      />
      <CreatePageWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} />
    </div>
  );
}
