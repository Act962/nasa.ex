"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, ExternalLink, Lock, Plus, Settings2, Eye, Trash2,
} from "lucide-react";
import type { Integration } from "@/types/integration";
import { CATEGORY_ICONS } from "@/types/integration";
import Link from "next/link";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import { useOrgRole } from "@/hooks/use-org-role";
import { StarCostBadge } from "@/features/stars";

interface IntegrationCardProps {
  integration: Integration;
  onInstall?: (integration: Integration) => void;
  compact?: boolean;
}

const TAG_COLORS: Record<string, string> = {
  "Popular":     "bg-info/15 text-info",
  "Novo":        "bg-info/15 text-info",
  "IA":          "bg-info/15 text-info",
  "Gratuito":    "bg-success/15 text-success",
  "Brasileiro":  "bg-warning/15 text-warning",
  "Open Source": "bg-muted text-muted-foreground",
  "Enterprise":  "bg-info/15 text-info",
};

function IntegrationLogo({ icon, name, category }: { icon: string; name: string; category: Integration["category"] }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const fallbackEmoji = CATEGORY_ICONS[category] ?? "🔌";
  const isUrl = icon.startsWith("http");

  // For emoji icons, render directly
  if (!isUrl) {
    return (
      <div className="size-10 rounded-xl bg-gradient-to-br from-info/10 to-info/10 border border-info/20 flex items-center justify-center shrink-0 text-xl">
        {icon}
      </div>
    );
  }

  // For URL icons: show emoji immediately, swap to image once loaded
  return (
    <div className="size-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 relative">
      {/* Emoji fallback — always rendered underneath */}
      <div className={cn(
        "absolute inset-0 rounded-xl bg-gradient-to-br from-info/10 to-info/10 border border-info/20 flex items-center justify-center text-xl",
        imgLoaded && !imgFailed && "opacity-0",
      )}>
        {fallbackEmoji}
      </div>
      {/* Image — shown only when loaded successfully */}
      {!imgFailed && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={icon}
          alt={name}
          className={cn(
            "size-full object-contain absolute inset-0 bg-white p-1.5 transition-opacity duration-200",
            imgLoaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}

export function IntegrationCard({ integration, onInstall, compact = false }: IntegrationCardProps) {
  const { isInstalled, uninstall } = useMarketplace();
  const { isSingle } = useOrgRole();

  // Merge base status with runtime installed state
  const runtimeInstalled = isInstalled(integration.slug);
  const effectiveStatus = runtimeInstalled ? "installed" : integration.status;

  const showableTags = integration.tags
    .filter((t) => !["Instalado", "Visualizar"].includes(t))
    .slice(0, 2);

  const statusConfig = {
    installed: {
      label: "Instalado",
      badge: "bg-success/15 text-success border-success/30",
      dot: "bg-success",
    },
    available: {
      label: "Disponível",
      badge: "bg-info/10 text-info border-info/30",
      dot: "bg-info",
    },
    view_only: {
      label: "Em Breve",
      badge: "bg-warning/10 text-warning border-warning/30",
      dot: "bg-warning",
    },
  }[effectiveStatus];

  return (
    <div
      className={cn(
        "group relative border rounded-xl bg-card overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 hover:border-info/30",
        effectiveStatus === "installed" && "border-success/30 bg-gradient-to-br from-success/5 to-card",
        compact ? "p-3" : "p-4",
      )}
    >
      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5 transition-opacity",
        effectiveStatus === "installed"
          ? "bg-gradient-to-r from-success to-success opacity-100"
          : "bg-gradient-to-r from-info to-info/70 opacity-0 group-hover:opacity-100",
      )} />

      <div className={cn("flex gap-3", compact ? "items-center" : "items-start")}>
        <IntegrationLogo icon={integration.icon} name={integration.name} category={integration.category} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm leading-tight truncate">{integration.name}</h3>
                {effectiveStatus === "installed" && (
                  <CheckCircle2 className="size-3.5 text-success shrink-0" />
                )}
              </div>
              {!compact && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {integration.description}
                </p>
              )}
            </div>
            <Badge className={cn("text-[10px] shrink-0 border", statusConfig.badge)}>
              <span className={cn("size-1.5 rounded-full mr-1 inline-block", statusConfig.dot)} />
              {statusConfig.label}
            </Badge>
          </div>

          {!compact && showableTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {showableTags.map((tag) => (
                <span key={tag} className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", TAG_COLORS[tag] ?? "bg-muted text-muted-foreground")}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {!compact && (
            <StarCostBadge appSlug={integration.slug} showSetup className="pt-0.5" />
          )}
        </div>
      </div>

      {/* Actions */}
      {!compact && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
          {integration.hubPageEnabled && (
            <Link href={`/integrations/${integration.slug}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                <Eye className="size-3" /> Detalhes
              </Button>
            </Link>
          )}

          <div className="ml-auto flex gap-1.5">
            {isSingle ? (
              /* Single users see a locked state instead of action buttons */
              <Button variant="outline" size="sm"
                className="h-7 text-xs gap-1 border-border text-muted-foreground cursor-not-allowed"
                disabled
                title="Seu perfil não tem permissão para instalar ou configurar satélites">
                <Lock className="size-3" /> Sem permissão
              </Button>
            ) : effectiveStatus === "installed" ? (
              <>
                <Button variant="outline" size="sm"
                  className="h-7 text-xs gap-1 border-success/30 text-success hover:bg-success/10"
                  asChild>
                  <Link href={`/integrations/${integration.slug}`}>
                    <Settings2 className="size-3" /> Configurar
                  </Link>
                </Button>
                {/* Only allow uninstall if runtime-installed (not hardcoded) */}
                {runtimeInstalled && (
                  <Button variant="ghost" size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    title="Desinstalar"
                    onClick={() => uninstall(integration.slug)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </>
            ) : effectiveStatus === "view_only" ? (
              <Button variant="outline" size="sm"
                className="h-7 text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10 cursor-not-allowed"
                disabled>
                <Lock className="size-3" /> Em Breve
              </Button>
            ) : (
              <Button size="sm"
                className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => onInstall?.(integration)}>
                <Plus className="size-3" /> Instalar
              </Button>
            )}
            {!isSingle && integration.connectUrl && (
              <Button variant="ghost" size="icon" className="size-7" asChild>
                <a href={integration.connectUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
