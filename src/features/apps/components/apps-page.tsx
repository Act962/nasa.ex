"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";
import { StarsWidget } from "@/features/stars";
import { SpacePointWidget } from "@/features/space-point";
import { APPS, type AppDef } from "./apps-data";
import { AppCard, ComingSoonModal } from "./app-card";
import { PersonalizarMenu } from "./personalizar-menu";

// ─── Filter Bar ───────────────────────────────────────────────────────────────

type Filter =
  | "all"
  | "installed"
  | "development"
  | "available"
  | "personalizar";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "installed", label: "Instalados" },
  { value: "development", label: "Em Construção" },
  { value: "available", label: "Disponíveis" },
  { value: "personalizar", label: "Personalizar" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AppsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [modalApp, setModalApp] = useState<AppDef | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredApps = APPS.filter((app) => {
    if (filter === "all") return true;
    if (filter === "installed") return app.status === "installed";
    if (filter === "development") return app.status === "development";
    if (filter === "available") return app.status === "available";
    return true;
  });

  const handleAction = (app: AppDef) => {
    if (app.action === "external" && app.href) {
      window.open(app.href, "_blank", "noopener,noreferrer");
    } else if (app.action === "internal" && app.href) {
      router.push(app.href);
    } else {
      setModalApp(app);
      setModalOpen(true);
    }
  };

  const installedCount = APPS.filter((a) => a.status === "installed").length;
  const devCount = APPS.filter((a) => a.status === "development").length;

  return (
    <div className="min-h-full bg-background w-full">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b bg-linear-to-br from-[#7C3AED]/5 via-background to-background">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#7C3AED]/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-[#7C3AED]/3 blur-2xl" />
        </div>

        <div className="relative px-6 py-10 mx-auto">
          <div className="flex items-center justify-end gap-2 mb-4">
            <SpacePointWidget />
            <StarsWidget />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex gap-1">
              {["#7C3AED", "#a855f7", "#c084fc"].map((c, i) => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium tracking-widest uppercase">
              Ecossistema NASA
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
            Universo de Soluções{" "}
            <span className="text-[#7C3AED]">N.A.S.A®</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Todas as ferramentas do ecossistema NASA em um só lugar
          </p>

          {/* Stats */}
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold">{installedCount}</span>
              <span className="text-muted-foreground">instalados</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-semibold">{devCount}</span>
              <span className="text-muted-foreground">em desenvolvimento</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
              <span className="font-semibold">{APPS.length}</span>
              <span className="text-muted-foreground">total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-4 mx-auto">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const count =
              f.value === "all"
                ? APPS.length
                : f.value === "installed"
                  ? installedCount
                  : f.value === "development"
                    ? devCount
                    : 0;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  filter === f.value
                    ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-[#7C3AED]/50 hover:text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "text-[11px] px-1.5 py-0.5 rounded-full",
                    filter === f.value
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid / Personalizar */}
      <div className="px-6 pb-10  mx-auto">
        {filter === "personalizar" ? (
          <PersonalizarMenu />
        ) : filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Package className="size-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              Nenhum app encontrado nesta categoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => (
              <AppCard key={app.id} app={app} onAction={handleAction} />
            ))}
          </div>
        )}
      </div>

      {/* Coming Soon Modal */}
      <ComingSoonModal
        app={modalApp}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalApp(null);
        }}
      />
    </div>
  );
}
