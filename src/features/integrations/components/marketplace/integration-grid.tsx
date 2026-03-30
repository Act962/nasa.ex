"use client";

import { useState, useMemo } from "react";
import { integrations as ALL_INTEGRATIONS } from "@/data/integrations";
import type { Integration, IntegrationCategory } from "@/types/integration";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types/integration";
import { IntegrationCard } from "./integration-card";
import { InstallModal } from "./install-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import {
  Search, LayoutGrid, List, CheckCircle2, Puzzle,
} from "lucide-react";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as IntegrationCategory[];

function GridSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="border rounded-xl p-4 space-y-3">
          <div className="flex gap-3">
            <Skeleton className="size-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <Skeleton className="h-7 w-full" />
        </div>
      ))}
    </div>
  );
}

interface IntegrationGridProps {
  isLoading?: boolean;
}

export function IntegrationGrid({ isLoading = false }: IntegrationGridProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | "ALL" | "INSTALLED">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [installing, setInstalling] = useState<Integration | null>(null);
  const { installedSlugs, isInstalled } = useMarketplace();

  const filtered = useMemo(() => {
    return ALL_INTEGRATIONS.filter((i) => {
      const runtimeInstalled = installedSlugs.has(i.slug);
      const effectiveInstalled = runtimeInstalled || i.status === "installed";

      const matchSearch =
        !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        i.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

      const matchCategory =
        selectedCategory === "ALL" ||
        (selectedCategory === "INSTALLED" && effectiveInstalled) ||
        i.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedCategory, installedSlugs]);

  // Count: hardcoded installed + runtime installed
  const installedCount = useMemo(() => {
    const hardcoded = ALL_INTEGRATIONS.filter((i) => i.status === "installed").map((i) => i.slug);
    const runtime = [...installedSlugs];
    return new Set([...hardcoded, ...runtime]).size;
  }, [installedSlugs]);

  // Group by category when showing all
  const grouped = useMemo(() => {
    if (selectedCategory !== "ALL" || search) return null;
    const map = new Map<IntegrationCategory, Integration[]>();
    for (const item of filtered) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [filtered, selectedCategory, search]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0">
      {/* ── Sidebar ── */}
      <aside className="w-full lg:w-56 shrink-0">
        <div className="lg:sticky lg:top-4 space-y-1">
          {/* All */}
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-all",
              selectedCategory === "ALL"
                ? "bg-[#7C3AED] text-white shadow-sm"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <Puzzle className="size-4 shrink-0" />
            <span className="flex-1">Todas</span>
            <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-semibold",
              selectedCategory === "ALL" ? "bg-white/20" : "bg-muted")}>
              {ALL_INTEGRATIONS.length}
            </span>
          </button>

          {/* Installed */}
          <button
            onClick={() => setSelectedCategory("INSTALLED")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-all",
              selectedCategory === "INSTALLED"
                ? "bg-emerald-600 text-white shadow-sm"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="flex-1">Instalados</span>
            {installedCount > 0 && (
              <span className={cn("text-[10px] rounded-full px-1.5 py-0.5 font-semibold",
                selectedCategory === "INSTALLED" ? "bg-white/20" : "bg-emerald-100 text-emerald-700")}>
                {installedCount}
              </span>
            )}
          </button>

          <div className="h-px bg-border my-2" />

          {/* Categories */}
          <div className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
            {ALL_CATEGORIES.map((cat) => {
              const count = ALL_INTEGRATIONS.filter((i) => i.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-all",
                    selectedCategory === cat
                      ? "bg-[#7C3AED]/10 text-[#7C3AED] font-semibold"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="text-base leading-none">{CATEGORY_ICONS[cat]}</span>
                  <span className="flex-1 truncate">{CATEGORY_LABELS[cat]}</span>
                  <span className={cn("text-[10px] rounded-full px-1.5 py-0.5",
                    selectedCategory === cat ? "bg-[#7C3AED]/20" : "bg-muted")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search + view toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar integração..."
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex rounded-lg border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("px-2.5 py-1.5 transition-colors", viewMode === "grid" ? "bg-[#7C3AED] text-white" : "text-muted-foreground hover:bg-muted")}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("px-2.5 py-1.5 transition-colors", viewMode === "list" ? "bg-[#7C3AED] text-white" : "text-muted-foreground hover:bg-muted")}
            >
              <List className="size-4" />
            </button>
          </div>

          {search && (
            <Badge variant="secondary" className="shrink-0 gap-1">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
              <button onClick={() => setSearch("")} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <GridSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <Puzzle className="size-12 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium">Nenhuma integração encontrada</p>
            <p className="text-xs text-muted-foreground">Tente outro termo de busca ou categoria</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSelectedCategory("ALL"); }}>
              Ver todas
            </Button>
          </div>
        ) : grouped ? (
          /* Grouped view (all categories, no search) */
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([cat, items]) => (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                  <h2 className="text-sm font-semibold">{CATEGORY_LABELS[cat]}</h2>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className="ml-auto text-xs text-[#7C3AED] hover:underline"
                  >
                    Ver todos →
                  </button>
                </div>
                <div className={cn(
                  "grid gap-3",
                  viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
                )}>
                  {items.slice(0, viewMode === "grid" ? 6 : 4).map((item) => (
                    <IntegrationCard
                      key={item.id}
                      integration={item}
                      onInstall={setInstalling}
                      compact={viewMode === "list"}
                    />
                  ))}
                </div>
                {items.length > (viewMode === "grid" ? 6 : 4) && (
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className="mt-2 text-xs text-muted-foreground hover:text-[#7C3AED] transition-colors"
                  >
                    + {items.length - (viewMode === "grid" ? 6 : 4)} mais em {CATEGORY_LABELS[cat]}
                  </button>
                )}
              </section>
            ))}
          </div>
        ) : (
          /* Flat view (filtered by category or search) */
          <div>
            {selectedCategory !== "ALL" && !search && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">
                  {selectedCategory === "INSTALLED" ? "✅" : CATEGORY_ICONS[selectedCategory as IntegrationCategory]}
                </span>
                <h2 className="text-sm font-semibold">
                  {selectedCategory === "INSTALLED" ? "Instalados" : CATEGORY_LABELS[selectedCategory as IntegrationCategory]}
                </h2>
                <Badge variant="secondary" className="text-[10px]">{filtered.length}</Badge>
              </div>
            )}
            <div className={cn(
              "grid gap-3",
              viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
            )}>
              {filtered.map((item) => (
                <IntegrationCard
                  key={item.id}
                  integration={item}
                  onInstall={setInstalling}
                  compact={viewMode === "list"}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Install modal */}
      {installing && (
        <InstallModal
          integration={installing}
          open={!!installing}
          onClose={() => setInstalling(null)}
        />
      )}
    </div>
  );
}
