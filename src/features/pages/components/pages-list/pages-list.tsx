"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutTemplate, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { usePages, usePagesCost } from "../../hooks/use-pages";
import { usePagesOrbitDock } from "../../hooks/use-pages-orbit-dock";
import { CreatePageWizard } from "../wizard/create-page-wizard";
import { PageSiteCard, type DeletePageTarget } from "./page-site-card";
import { DeletePageDialog } from "./delete-page-dialog";
import { PagesKpis } from "./pages-kpis";

type StatusFilter = "all" | "published" | "draft";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "published", label: "Publicados" },
  { id: "draft", label: "Rascunhos" },
];

export function PagesList() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeletePageTarget | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data, isLoading } = usePages();
  const { data: cost } = usePagesCost();

  usePagesOrbitDock({ activeSection: "sites", onCreateSite: () => setIsWizardOpen(true) });

  const sites = useMemo(() => data?.pages ?? [], [data?.pages]);
  const publishedCount = sites.filter((site) => site.status === "PUBLISHED").length;
  const filterCounts: Record<StatusFilter, number> = {
    all: sites.length,
    published: publishedCount,
    draft: sites.length - publishedCount,
  };

  const visibleSites = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return sites.filter((site) => {
      const isPublished = site.status === "PUBLISHED";
      if (statusFilter === "published" && !isPublished) return false;
      if (statusFilter === "draft" && isPublished) return false;
      if (!normalizedTerm) return true;
      return [site.title, site.slug, site.customDomain ?? ""].some((text) =>
        text.toLowerCase().includes(normalizedTerm),
      );
    });
  }, [sites, searchTerm, statusFilter]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15 md:size-11">
            <Sparkles className="size-5 text-info" />
          </div>
          <div className="min-w-0 flex-1">
            {/* Celular: o título é a seção atual (o menu de baixo troca de seção); computador: o nome do app. */}
            <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:hidden">Sites</h1>
            <h1 className="truncate text-2xl leading-tight font-semibold max-md:hidden">ÓRBITA Pages</h1>
            <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">
              Sites e landing pages ligados ao seu funil na ÓRBITA.
            </p>
          </div>
          <Button
            asChild
            size="icon"
            variant="ghost"
            className="size-10 shrink-0 rounded-full bg-knob md:hidden"
            aria-label="Templates"
            title="Templates"
          >
            <Link href="/pages/templates">
              <LayoutTemplate className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-2 rounded-full max-md:hidden">
            <Link href="/pages/templates">
              <LayoutTemplate className="size-4" />
              Templates
            </Link>
          </Button>
          <Button
            onClick={() => setIsWizardOpen(true)}
            className="h-11 gap-2 rounded-full max-md:w-full md:h-9"
            data-guide={GUIDE_ANCHORS.pagesNewButton.id}
          >
            <Plus className="size-4" />
            Novo site
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <OrbitaSpinner className="size-8" />
        </div>
      ) : !sites.length ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-line px-6 py-10 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">Nenhum site ainda</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Crie seu primeiro site por {(cost?.stars ?? 2000).toLocaleString("pt-BR")} Stars. Você pode ter quantos
            sites quiser na empresa.
          </p>
          <Button onClick={() => setIsWizardOpen(true)} className="mt-1 h-11 gap-2 rounded-full">
            <Plus className="size-4" />
            Começar
          </Button>
        </div>
      ) : (
        <>
          <PagesKpis
            siteCount={sites.length}
            publishedCount={publishedCount}
            draftCount={sites.length - publishedCount}
            starsPerSite={cost?.stars ?? null}
          />

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar site"
                aria-label="Buscar site"
                className="h-11 rounded-full pl-10"
              />
            </div>
            <div className="scroll-hidden-x -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors",
                    statusFilter === filter.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-line bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                  <span className="text-xs opacity-70">{filterCounts[filter.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {visibleSites.length === 0 ? (
            <p className="rounded-[22px] border border-dashed border-line px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhum site encontrado com esse filtro.
            </p>
          ) : (
            <div
              className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4"
              data-guide={GUIDE_ANCHORS.pagesList.id}
            >
              {visibleSites.map((site) => (
                <PageSiteCard key={site.id} site={site} onDeleteRequest={setDeleteTarget} />
              ))}
            </div>
          )}
        </>
      )}

      <CreatePageWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} />
      <DeletePageDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
