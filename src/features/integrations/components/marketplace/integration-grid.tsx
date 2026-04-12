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
  Search, LayoutGrid, List, CheckCircle2, Puzzle, Plug, Link2Off,
} from "lucide-react";
import type { PlatformDef } from "@/features/integrations/components/integrations-page";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { useOrgRole } from "@/hooks/use-org-role";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as IntegrationCategory[];

// Platform category sidebar labels
const PLATFORM_CAT_META: Record<string, { label: string; icon: string }> = {
  messaging:  { label: "Mensagens & Chat",     icon: "💬" },
  ads:        { label: "Anúncios & Marketing", icon: "📊" },
  social:     { label: "Redes Sociais",        icon: "📱" },
  email:      { label: "E-mail",               icon: "📧" },
  maps:       { label: "Localização & Mapas",  icon: "🗺️" },
  ai:         { label: "IA & Modelos",         icon: "🤖" },
  crm:        { label: "CRM & Vendas",         icon: "🏢" },
};

type PlatformCategory = keyof typeof PLATFORM_CAT_META;
type SelectedCategory = IntegrationCategory | PlatformCategory | "ALL" | "INSTALLED";

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

// ─── Platform Def Card ────────────────────────────────────────────────────────

function PlatformDefCard({
  def,
  isConnected,
  onConfigure,
  onDisconnect,
}: {
  def: PlatformDef;
  isConnected: boolean;
  onConfigure: () => void;
  onDisconnect: () => void;
}) {
  const { isSingle } = useOrgRole();
  const Icon = def.icon;

  return (
    <div className={cn(
      "group relative border rounded-xl bg-card overflow-hidden transition-all duration-200",
      "hover:shadow-[0_4px_20px_rgba(124,58,237,0.12)] hover:-translate-y-0.5 hover:border-[#7C3AED]/30",
      isConnected && "border-emerald-200/70 bg-gradient-to-br from-emerald-50/30 to-card dark:from-emerald-950/20",
      "p-4",
    )}>
      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5 transition-opacity",
        isConnected
          ? "bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-100"
          : "bg-gradient-to-r from-[#7C3AED] to-[#a855f7] opacity-0 group-hover:opacity-100",
      )} />

      <div className="flex gap-3 items-start">
        <div className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border", def.bgColor, def.borderColor)}>
          <Icon className={cn("w-5 h-5", def.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-sm leading-tight truncate">{def.label}</h3>
                {isConnected && <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />}
              </div>
            </div>
            <Badge className={cn(
              "text-[10px] shrink-0 border",
              isConnected
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-blue-50 text-blue-600 border-blue-200"
            )}>
              <span className={cn("size-1.5 rounded-full mr-1 inline-block", isConnected ? "bg-emerald-500" : "bg-blue-400")} />
              {isConnected ? "Conectado" : "Disponível"}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{def.description}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
        {isSingle ? (
          <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1 border-slate-200 text-slate-400 cursor-not-allowed" disabled>
            Sem permissão
          </Button>
        ) : def.platform === "WHATSAPP" ? (
          <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" asChild>
            <a href={def.docsUrl}><Plug className="size-3" />{def.docsLabel}</a>
          </Button>
        ) : isConnected ? (
          <>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={onConfigure}>
              <Plug className="size-3" /> Reconfigurar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive text-xs" onClick={onDisconnect}>
              <Link2Off className="size-3" />
            </Button>
          </>
        ) : (
          <Button size="sm" className="w-full h-7 gap-1.5 text-xs bg-[#7C3AED] hover:bg-[#6D28D9] text-white" onClick={onConfigure}>
            <Plug className="size-3" /> Conectar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Grid ────────────────────────────────────────────────────────────────

interface IntegrationGridProps {
  isLoading?: boolean;
  platformDefs?: PlatformDef[];
  connectedPlatforms?: Set<string>;
  onConfigurePlatform?: (def: PlatformDef) => void;
  onDisconnectPlatform?: (platform: IntegrationPlatform) => void;
}

export function IntegrationGrid({
  isLoading = false,
  platformDefs = [],
  connectedPlatforms = new Set(),
  onConfigurePlatform,
  onDisconnectPlatform,
}: IntegrationGridProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [installing, setInstalling] = useState<Integration | null>(null);
  const { installedSlugs } = useMarketplace();

  const isPlatformCategory = (cat: SelectedCategory): cat is PlatformCategory =>
    Object.keys(PLATFORM_CAT_META).includes(cat as string);

  // Filtered marketplace integrations
  const filteredMarketplace = useMemo(() => {
    if (isPlatformCategory(selectedCategory)) return [];
    return ALL_INTEGRATIONS.filter((i) => {
      const runtimeInstalled = installedSlugs.has(i.slug);
      const effectiveInstalled = runtimeInstalled || i.status === "installed";
      const matchSearch = !search ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        i.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchCategory =
        selectedCategory === "ALL" ||
        (selectedCategory === "INSTALLED" && effectiveInstalled) ||
        i.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [search, selectedCategory, installedSlugs]);

  // Filtered platform defs
  const filteredPlatform = useMemo(() => {
    if (selectedCategory === "INSTALLED") return [];
    return platformDefs.filter((d) => {
      const matchSearch = !search ||
        d.label.toLowerCase().includes(search.toLowerCase()) ||
        d.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory =
        selectedCategory === "ALL" ||
        d.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [search, selectedCategory, platformDefs]);

  // Count installed
  const installedCount = useMemo(() => {
    const hardcoded = ALL_INTEGRATIONS.filter((i) => i.status === "installed").map((i) => i.slug);
    return new Set([...hardcoded, ...installedSlugs]).size;
  }, [installedSlugs]);

  // Platform categories that have items
  const activePlatformCats = useMemo(() => {
    return Object.keys(PLATFORM_CAT_META).filter(cat =>
      platformDefs.some(d => d.category === cat)
    ) as PlatformCategory[];
  }, [platformDefs]);

  const totalResults = filteredMarketplace.length + filteredPlatform.length;

  // Group marketplace by category when showing all
  const grouped = useMemo(() => {
    if (selectedCategory !== "ALL" || search) return null;
    const map = new Map<IntegrationCategory, Integration[]>();
    for (const item of filteredMarketplace) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return map;
  }, [filteredMarketplace, selectedCategory, search]);

  // Group platform defs by category when showing all
  const groupedPlatform = useMemo(() => {
    if (selectedCategory !== "ALL" || search) return null;
    const map = new Map<string, PlatformDef[]>();
    for (const def of platformDefs) {
      const arr = map.get(def.category) ?? [];
      arr.push(def);
      map.set(def.category, arr);
    }
    return map;
  }, [platformDefs, selectedCategory, search]);

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
              {ALL_INTEGRATIONS.length + platformDefs.length}
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

          {/* Platform categories (Canais & Plataformas) */}
          {activePlatformCats.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-0.5">
                Canais & Plataformas
              </p>
              <div className="space-y-0.5">
                {activePlatformCats.map((cat) => {
                  const count = platformDefs.filter(d => d.category === cat).length;
                  const meta = PLATFORM_CAT_META[cat];
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
                      <span className="text-base leading-none">{meta.icon}</span>
                      <span className="flex-1 truncate">{meta.label}</span>
                      <span className={cn("text-[10px] rounded-full px-1.5 py-0.5",
                        selectedCategory === cat ? "bg-[#7C3AED]/20" : "bg-muted")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="h-px bg-border my-2" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-1 pb-0.5">
                Marketplace
              </p>
            </>
          )}

          {/* Marketplace categories */}
          <div className="space-y-0.5 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin">
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
              {totalResults} resultado{totalResults !== 1 ? "s" : ""}
              <button onClick={() => setSearch("")} className="ml-0.5 hover:text-destructive">×</button>
            </Badge>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <GridSkeleton />
        ) : totalResults === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <Puzzle className="size-12 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium">Nenhuma integração encontrada</p>
            <p className="text-xs text-muted-foreground">Tente outro termo de busca ou categoria</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setSelectedCategory("ALL"); }}>
              Ver todas
            </Button>
          </div>
        ) : grouped && groupedPlatform ? (
          /* Grouped view (all categories, no search) */
          <div className="space-y-8">
            {/* Platform def groups first */}
            {Array.from(groupedPlatform.entries()).map(([cat, items]) => {
              const meta = PLATFORM_CAT_META[cat];
              if (!meta) return null;
              return (
                <section key={`platform-${cat}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{meta.icon}</span>
                    <h2 className="text-sm font-semibold">{meta.label}</h2>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                    <button
                      onClick={() => setSelectedCategory(cat as PlatformCategory)}
                      className="ml-auto text-xs text-[#7C3AED] hover:underline"
                    >
                      Ver todos →
                    </button>
                  </div>
                  <div className={cn(
                    "grid gap-3",
                    viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
                  )}>
                    {items.slice(0, viewMode === "grid" ? 6 : 4).map((def) => (
                      <PlatformDefCard
                        key={String(def.platform)}
                        def={def}
                        isConnected={def.platform === "WHATSAPP" ? true : connectedPlatforms.has(String(def.platform))}
                        onConfigure={() => onConfigurePlatform?.(def)}
                        onDisconnect={() => def.platform !== "WHATSAPP" && onDisconnectPlatform?.(def.platform as IntegrationPlatform)}
                      />
                    ))}
                  </div>
                  {items.length > (viewMode === "grid" ? 6 : 4) && (
                    <button
                      onClick={() => setSelectedCategory(cat as PlatformCategory)}
                      className="mt-2 text-xs text-muted-foreground hover:text-[#7C3AED] transition-colors"
                    >
                      + {items.length - (viewMode === "grid" ? 6 : 4)} mais em {meta.label}
                    </button>
                  )}
                </section>
              );
            })}

            {/* Marketplace groups */}
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
          <div className="space-y-6">
            {/* Platform defs section */}
            {filteredPlatform.length > 0 && (
              <div>
                {(isPlatformCategory(selectedCategory) || search) && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">
                      {isPlatformCategory(selectedCategory) ? PLATFORM_CAT_META[selectedCategory]?.icon : "🔌"}
                    </span>
                    <h2 className="text-sm font-semibold">
                      {isPlatformCategory(selectedCategory)
                        ? PLATFORM_CAT_META[selectedCategory]?.label
                        : "Canais & Plataformas"}
                    </h2>
                    <Badge variant="secondary" className="text-[10px]">{filteredPlatform.length}</Badge>
                  </div>
                )}
                <div className={cn(
                  "grid gap-3",
                  viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
                )}>
                  {filteredPlatform.map((def) => (
                    <PlatformDefCard
                      key={String(def.platform)}
                      def={def}
                      isConnected={def.platform === "WHATSAPP" ? true : connectedPlatforms.has(String(def.platform))}
                      onConfigure={() => onConfigurePlatform?.(def)}
                      onDisconnect={() => def.platform !== "WHATSAPP" && onDisconnectPlatform?.(def.platform as IntegrationPlatform)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Marketplace items section */}
            {filteredMarketplace.length > 0 && (
              <div>
                {search && filteredPlatform.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🔌</span>
                    <h2 className="text-sm font-semibold">Marketplace</h2>
                    <Badge variant="secondary" className="text-[10px]">{filteredMarketplace.length}</Badge>
                  </div>
                )}
                {selectedCategory !== "ALL" && !search && !isPlatformCategory(selectedCategory) && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">
                      {selectedCategory === "INSTALLED" ? "✅" : CATEGORY_ICONS[selectedCategory as IntegrationCategory]}
                    </span>
                    <h2 className="text-sm font-semibold">
                      {selectedCategory === "INSTALLED" ? "Instalados" : CATEGORY_LABELS[selectedCategory as IntegrationCategory]}
                    </h2>
                    <Badge variant="secondary" className="text-[10px]">{filteredMarketplace.length}</Badge>
                  </div>
                )}
                <div className={cn(
                  "grid gap-3",
                  viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
                )}>
                  {filteredMarketplace.map((item) => (
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
