"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Users,
  Package,
  Link2,
  Clock,
  Rocket,
  PanelLeft,
} from "lucide-react";
import { useSidebarPrefs, useSetSidebarPref, isItemVisible } from "@/hooks/use-sidebar-prefs";
import { SIDEBAR_NAV_ITEMS } from "@/lib/sidebar-items";
import type { AppDef, AppStatus } from "./apps-data";

export type { AppDef, AppStatus };

// ─── Status Badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: AppStatus }) {
  if (status === "installed")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[11px] gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
        Instalado
      </Badge>
    );
  if (status === "development")
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[11px] gap-1">
        🔧 Em construção
      </Badge>
    );
  return (
    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-[11px] gap-1">
      + Disponível
    </Badge>
  );
}

// ─── Sidebar Toggle ───────────────────────────────────────────────────────────

export function SidebarToggle({
  sidebarKey,
  defaultVisible,
}: {
  sidebarKey: string;
  defaultVisible: boolean;
}) {
  const { data: prefs } = useSidebarPrefs();
  const setPref = useSetSidebarPref();
  const visible = isItemVisible(prefs, `app:${sidebarKey}`, defaultVisible);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setPref.mutate({ itemKey: `app:${sidebarKey}`, visible: !visible });
      }}
      title={visible ? "Ocultar do menu lateral" : "Mostrar no menu lateral"}
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors",
        visible
          ? "bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
          : "bg-muted text-muted-foreground border-border hover:border-violet-500/30 hover:text-violet-400",
      )}
    >
      <PanelLeft className="size-2.5" />
      {visible ? "No menu" : "Oculto"}
    </button>
  );
}

// ─── App Card ─────────────────────────────────────────────────────────────────

export function AppCard({
  app,
  onAction,
}: {
  app: AppDef;
  onAction: (app: AppDef) => void;
}) {
  const Icon = app.icon;
  const sidebarItem = app.sidebarKey
    ? SIDEBAR_NAV_ITEMS.find((i) => i.key === app.sidebarKey)
    : null;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border-2 bg-card transition-all duration-200 overflow-hidden cursor-pointer",
        "hover:border-[#7C3AED] hover:shadow-lg hover:shadow-[#7C3AED]/10 hover:-translate-y-0.5",
        app.status === "installed" ? "border-border" : "border-border",
      )}
      onClick={() => onAction(app)}
    >
      {/* Purple accent top bar on hover */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#7C3AED] to-[#a855f7] opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm">
          <Icon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-black text-sm tracking-wide leading-tight">
                {app.name}
              </h3>
              <p className="text-[10px] text-muted-foreground">{app.byline}</p>
            </div>
            <StatusBadge status={app.status} />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 pb-4 flex-1">
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {app.shortDesc}
        </p>
      </div>

      {/* Metadata */}
      <div className="px-5 pb-4 grid grid-cols-2 gap-2">
        {app.activeUsers !== undefined && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3 shrink-0" />
            <span>{app.activeUsers ?? "—"}</span>
          </div>
        )}
        {app.status === "development" && (
          <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <Clock className="size-3 shrink-0" />
            <span>Em breve</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Package className="size-3 shrink-0" />
          <span>{app.category}</span>
        </div>
        {app.integration && app.integration !== "—" && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Link2 className="size-3 shrink-0" />
            <span>{app.integration}</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="px-5 pb-5 flex flex-col gap-2">
        {app.status === "installed" ? (
          <Button
            size="sm"
            className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onAction(app);
            }}
          >
            {app.action === "external" && <ExternalLink className="size-3.5" />}
            Abrir App
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5 text-xs text-muted-foreground cursor-default"
            disabled
          >
            <Clock className="size-3.5" />
            Em Breve
          </Button>
        )}
        {sidebarItem && (
          <SidebarToggle
            sidebarKey={app.sidebarKey!}
            defaultVisible={sidebarItem.defaultVisible}
          />
        )}
      </div>
    </div>
  );
}

// ─── Coming Soon Modal ────────────────────────────────────────────────────────

export function ComingSoonModal({
  app,
  open,
  onClose,
}: {
  app: AppDef | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!app) return null;
  const Icon = app.icon;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <Icon />
            </div>
          </div>
          <DialogTitle className="text-xl font-black tracking-wide flex items-center justify-center gap-2">
            <Rocket className="size-5 text-[#7C3AED]" />
            {app.name} está chegando!
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2 mb-6">
          {app.fullDesc}
        </p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
            <Package className="size-3" /> {app.category}
          </div>
          {app.status === "development" ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-medium">
              🔧 Em construção
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              ✦ Em breve nesta tela
            </div>
          )}
        </div>
        <Button
          onClick={onClose}
          className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
        >
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}
