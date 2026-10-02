"use client";

import type React from "react";
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
  Link as LinkIcon,
  Package,
  Clock,
  Rocket,
  PlusIcon,
  MinusIcon,
} from "lucide-react";
import { useSidebarPrefs, useSetSidebarPref, isItemVisible } from "@/hooks/use-sidebar-prefs";
import { SIDEBAR_NAV_ITEMS } from "@/features/apps/lib/sidebar-items";
import type { AppDef, AppStatus } from "./apps-data";
import { toast } from "sonner";
import { APP_LINK_PATH, appLinkKeyOf, resolveAppLink } from "@/features/apps/lib/app-signup-link";

export type { AppDef, AppStatus };

// ─── Status Badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: AppStatus }) {
  if (status === "installed")
    return (
      <Badge className="bg-success/15 text-success border-success/30 text-[11px] gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
        Instalado
      </Badge>
    );
  if (status === "development")
    return (
      <Badge className="bg-warning/15 text-warning border-warning/30 text-[11px] gap-1">
        🔧 Em construção
      </Badge>
    );
  return (
    <Badge className="bg-info/15 text-info border-info/30 text-[11px] gap-1">
      + Disponível
    </Badge>
  );
}

// ─── Sidebar Toggle ───────────────────────────────────────────────────────────

/**
 * Botão de ícone "+" (adicionar ao menu lateral) ou "-" (remover) — visual
 * compacto pra encaixar no header do card sem atrapalhar o layout. Posiciona
 * via `absolute top-2 right-2` no AppCard.
 *
 * Estado:
 *  - App NÃO está no sidebar (visible=false) → mostra "+" (verde claro)
 *  - App ESTÁ no sidebar (visible=true)      → mostra "-" (violeta claro)
 *
 * `stopPropagation` evita disparar o `onAction` do card ao clicar.
 */
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
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPref.mutate({ itemKey: `app:${sidebarKey}`, visible: !visible });
      }}
      title={
        visible
          ? "Remover do menu lateral"
          : "Adicionar ao menu lateral"
      }
      aria-label={
        visible
          ? "Remover do menu lateral"
          : "Adicionar ao menu lateral"
      }
      className={cn(
        "size-6 rounded-full flex items-center justify-center border transition-colors shrink-0",
        visible
          ? "bg-info/15 text-info border-info/30 hover:bg-info/20"
          : "bg-success/15 text-success border-success/30 hover:bg-success/20",
      )}
    >
      {visible ? (
        <MinusIcon className="size-3.5" strokeWidth={3} />
      ) : (
        <PlusIcon className="size-3.5" strokeWidth={3} />
      )}
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
  const SidebarIcon = sidebarItem?.icon as React.ElementType | undefined;
  const appLink = resolveAppLink(appLinkKeyOf(app));

  const isInstalled = app.status === "installed";

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-card transition-all duration-300 overflow-hidden cursor-pointer",
        "hover:border-info/60 hover:shadow-lg hover:shadow-info/15 hover:-translate-y-1",
        // Sutil "vidro" — gradient interno + brilho de borda
        "before:absolute before:inset-0 before:rounded-2xl before:bg-linear-to-br before:from-info/[0.03] before:to-transparent before:pointer-events-none",
      )}
      onClick={() => onAction(app)}
    >
      {/* Glow violeta no hover (anel externo sutil) */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-info/0 group-hover:ring-info/30 transition-all pointer-events-none" />

      {/* Botão "+"/"-" flutuante no canto superior direito */}
      {sidebarItem && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <SidebarToggle
            sidebarKey={app.sidebarKey!}
            defaultVisible={sidebarItem.defaultVisible}
          />
        </div>
      )}

      {/* Status dot mini no canto superior ESQUERDO — não compete com nome */}
      <div className="absolute top-3 left-3 z-10">
        <StatusDot status={app.status} />
      </div>

      {/* Body — icon grande centrado + nome */}
      <div className="relative flex flex-col items-center justify-center gap-2.5 px-3 pt-8 pb-3 flex-1">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-md transition-transform duration-300",
            "group-hover:scale-110 group-hover:shadow-info/25",
          )}
        >
          <Icon />
        </div>
        <div className="text-center min-w-0 w-full px-1">
          <h3 className="font-bold text-[13px] tracking-tight leading-tight truncate">
            {app.name}
          </h3>
          <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
            {app.byline}
          </p>
        </div>
      </div>

      {/* Descrição compacta */}
      <div className="px-3 pb-2">
        <p className="text-[10.5px] text-muted-foreground leading-snug line-clamp-2 text-center min-h-[28px]">
          {app.shortDesc}
        </p>
      </div>

      {/* Menu chip — preview do ícone+nome no sidebar (igualzinho a como
          o app vai aparecer no menu lateral quando o user adicionar). */}
      {sidebarItem && SidebarIcon && (
        <div className="px-3 pb-2 flex justify-center">
          <div
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40"
            title={`No menu lateral: ${sidebarItem.title}`}
          >
            <SidebarIcon className="size-3" />
            <span>{sidebarItem.title}</span>
          </div>
        </div>
      )}

      {/* Action Button — compacto, gradient discreto, h-7 */}
      <div className="px-3 pb-3">
        {isInstalled ? (
          <div className="flex gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAction(app);
            }}
            className={cn(
              "flex-1 h-7 rounded-full text-[11px] font-medium",
              "bg-primary text-primary-foreground hover:bg-primary/90 transition-all",
              "shadow-sm",
              "flex items-center justify-center gap-1",
            )}
          >
            {app.action === "external" && <ExternalLink className="size-3" />}
            Abrir App
          </button>
          {appLink && (
            <button
              type="button"
              title="Copiar link do app: quem se cadastrar por ele já cai neste app"
              aria-label={`Copiar link do ${app.name}`}
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}${APP_LINK_PATH}/${appLinkKeyOf(app)}`;
                navigator.clipboard
                  .writeText(url)
                  .then(() => toast.success("Link do app copiado", { description: url }))
                  .catch(() => toast.error("Não foi possível copiar o link"));
              }}
              className="flex h-7 items-center gap-1 rounded-full border border-line px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <LinkIcon className="size-3" /> Link
            </button>
          )}
          </div>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              "w-full h-7 rounded-full text-[11px] font-medium",
              "bg-muted/50 text-muted-foreground border border-border/60",
              "flex items-center justify-center gap-1 cursor-default",
            )}
          >
            <Clock className="size-3" />
            Em Breve
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Status Dot ───────────────────────────────────────────────────────────────
// Versão mínima do badge — apenas o dot colorido como indicador discreto.
// Usado dentro do card pra deixar espaço pro nome + botões respirarem.

function StatusDot({ status }: { status: AppStatus }) {
  const config = {
    installed: { color: "bg-success", title: "Instalado" },
    development: { color: "bg-warning", title: "Em construção" },
    available: { color: "bg-info", title: "Disponível" },
  }[status];
  return (
    <div
      title={config.title}
      className={cn(
        "size-2 rounded-full ring-2 ring-background",
        config.color,
      )}
    />
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
            <Rocket className="size-5 text-info" />
            {app.name} está chegando!
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2 mb-6">
          {app.fullDesc}
        </p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/15 text-warning text-xs font-medium">
            <Package className="size-3" /> {app.category}
          </div>
          {app.status === "development" ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-info/15 text-info text-xs font-medium">
              🔧 Em construção
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/15 text-success text-xs font-medium">
              ✦ Em breve nesta tela
            </div>
          )}
        </div>
        <Button
          onClick={onClose}
          className="w-full"
        >
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}
