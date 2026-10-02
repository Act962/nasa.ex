"use client";

import { AstroSymbolIcon } from "@/components/astro-symbol-icon";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Button } from "@/components/ui/button";
import { Plus, Link2, LayoutGridIcon, UsersIcon, EyeIcon, MousePointerClickIcon, GlobeIcon, SearchXIcon } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { LinnkerPageCard } from "./linnker-page-card";
import { CreateLinnkerPageDialog } from "./create-linnker-page-dialog";
import { LinnkerKpiGrid } from "./linnker-kpi-grid";
import { LinnkerPagesFilters, type LinnkerStatusFilter } from "./pages/linnker-pages-filters";
import type { LinnkerPage } from "../types";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { AppReportButton } from "@/features/insights/components/app-report-button";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";

const PAGES_SECTION_ID = "linnker-pages";

function scrollToPages() {
  document.getElementById(PAGES_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function matchesStatus(page: LinnkerPage, statusFilter: LinnkerStatusFilter) {
  if (statusFilter === "published") return page.isPublished;
  if (statusFilter === "draft") return !page.isPublished;
  return true;
}

export function LinnkerPage_() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LinnkerStatusFilter>("all");

  const { data, isLoading, refetch } = useQuery(
    orpc.linnker.listPages.queryOptions({}),
  );

  const pages = useMemo(() => (data?.pages ?? []) as unknown as LinnkerPage[], [data]);

  const publishedCount = pages.filter((page) => page.isPublished).length;
  const countByStatus: Record<LinnkerStatusFilter, number> = {
    all: pages.length,
    published: publishedCount,
    draft: pages.length - publishedCount,
  };

  const kpis = [
    { label: "Páginas", value: pages.length, icon: <LayoutGridIcon /> },
    { label: "Publicadas", value: publishedCount, icon: <GlobeIcon /> },
    {
      label: "Links ativos",
      value: pages.reduce((total, page) => total + page.links.filter((link) => link.isActive).length, 0),
      icon: <MousePointerClickIcon />,
    },
    { label: "Visitas", value: pages.reduce((total, page) => total + (page._count?.scans ?? 0), 0), icon: <EyeIcon /> },
  ];

  const normalizedSearch = search.trim().toLowerCase();
  const visiblePages = pages.filter(
    (page) =>
      matchesStatus(page, statusFilter) &&
      (!normalizedSearch ||
        page.title.toLowerCase().includes(normalizedSearch) ||
        page.slug.toLowerCase().includes(normalizedSearch)),
  );

  useRegisterOrbitDock({
    leftItems: [
      { label: "Início", href: "/home?home=1", icon: <AstroSymbolIcon /> },
      { label: "Páginas", icon: <LayoutGridIcon />, onSelect: scrollToPages, isActive: true },
    ],
    rightItems: [
      { label: "Nova página", icon: <Plus />, onSelect: () => setIsCreateOpen(true) },
      { label: "Contatos", href: "/contatos", icon: <UsersIcon /> },
    ],
  });

  const openCreate = () => setIsCreateOpen(true);

  return (
    <div id={PAGES_SECTION_ID} className="w-full scroll-mt-16 px-4 pb-[150px] md:px-0 lg:pb-10">
      <div className="flex flex-col gap-3 pt-2 pb-4 md:flex-row md:items-center md:justify-between md:pt-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info/15 md:size-11">
            <Link2 className="size-5 text-info" />
          </div>
          <div className="min-w-0 flex-1">
            {/* Celular: o título é a seção atual; computador: o nome do app. */}
            <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:hidden">Páginas</h1>
            <h1 className="hidden text-2xl leading-tight font-semibold tracking-tight md:block">Linnker</h1>
            <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">
              <span className="md:hidden">Suas páginas de links e QR codes</span>
              <span className="max-md:hidden">Páginas de links com QR code para capturar leads</span>
            </p>
          </div>
          <AppReportButton appModule="linnker" isCompactOnMobile className="shrink-0 rounded-full max-sm:size-10" />
        </div>
        <Button
          onClick={openCreate}
          className="h-11 w-full rounded-full md:h-9 md:w-auto"
          data-guide={GUIDE_ANCHORS.linnkerNewButton.id}
        >
          <Plus className="size-4" />
          Nova página
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <OrbitaSpinner className="size-8" />
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-[22px] border border-dashed border-line px-6 py-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted">
            <Link2 className="size-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Nenhuma página ainda</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie sua primeira página e compartilhe todos os seus links num endereço só.
            </p>
          </div>
          <Button onClick={openCreate} className="h-11 rounded-full md:h-9">
            <Plus className="size-4" />
            Criar minha primeira página
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <LinnkerKpiGrid kpis={kpis} />
          <LinnkerPagesFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            countByStatus={countByStatus}
          />
          {visiblePages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-line px-6 py-12 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-muted">
                <SearchXIcon className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma página encontrada com esse filtro.</p>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
              data-guide={GUIDE_ANCHORS.linnkerList.id}
            >
              {visiblePages.map((page) => (
                <LinnkerPageCard key={page.id} page={page} onRefetch={refetch} />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateLinnkerPageDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => { setIsCreateOpen(false); refetch(); }}
      />
    </div>
  );
}
