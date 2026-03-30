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
import { StarCostBadge } from "@/features/stars";

interface IntegrationCardProps {
  integration: Integration;
  onInstall?: (integration: Integration) => void;
  compact?: boolean;
}

const TAG_COLORS: Record<string, string> = {
  "Popular":     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "Novo":        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "IA":          "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "Gratuito":    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Brasileiro":  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Open Source": "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400",
  "Enterprise":  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
};

function IntegrationLogo({ icon, name, category }: { icon: string; name: string; category: Integration["category"] }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const fallbackEmoji = CATEGORY_ICONS[category] ?? "🔌";
  const isUrl = icon.startsWith("http");

  // For emoji icons, render directly
  if (!isUrl) {
    return (
      <div className="size-10 rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#a855f7]/10 border border-[#7C3AED]/20 flex items-center justify-center shrink-0 text-xl">
        {icon}
      </div>
    );
  }

  // For URL icons: show emoji immediately, swap to image once loaded
  return (
    <div className="size-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 relative">
      {/* Emoji fallback — always rendered underneath */}
      <div className={cn(
        "absolute inset-0 rounded-xl bg-gradient-to-br from-[#7C3AED]/10 to-[#a855f7]/10 border border-[#7C3AED]/20 flex items-center justify-center text-xl",
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

  // Merge base status with runtime installed state
  const runtimeInstalled = isInstalled(integration.slug);
  const effectiveStatus = runtimeInstalled ? "installed" : integration.status;

  const showableTags = integration.tags
    .filter((t) => !["Instalado", "Visualizar"].includes(t))
    .slice(0, 2);

  const statusConfig = {
    installed: {
      label: "Instalado",
      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
    },
    available: {
      label: "Disponível",
      badge: "bg-blue-50 text-blue-600 border-blue-200",
      dot: "bg-blue-400",
    },
    view_only: {
      label: "Em Breve",
      badge: "bg-amber-50 text-amber-600 border-amber-200",
      dot: "bg-amber-400",
    },
  }[effectiveStatus];

  return (
    <div
      className={cn(
        "group relative border rounded-xl bg-card overflow-hidden transition-all duration-200",
        "hover:shadow-[0_4px_20px_rgba(124,58,237,0.12)] hover:-translate-y-0.5 hover:border-[#7C3AED]/30",
        effectiveStatus === "installed" && "border-emerald-200/70 bg-gradient-to-br from-emerald-50/30 to-card dark:from-emerald-950/20",
        compact ? "p-3" : "p-4",
      )}
    >
      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5 transition-opacity",
        effectiveStatus === "installed"
          ? "bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-100"
          : "bg-gradient-to-r from-[#7C3AED] to-[#a855f7] opacity-0 group-hover:opacity-100",
      )} />

      <div className={cn("flex gap-3", compact ? "items-center" : "items-start")}>
        <IntegrationLogo icon={integration.icon} name={integration.name} category={integration.category} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm leading-tight truncate">{integration.name}</h3>
                {effectiveStatus === "installed" && (
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
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
            {effectiveStatus === "installed" ? (
              <>
                <Button variant="outline" size="sm"
                  className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
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
                className="h-7 text-xs gap-1 border-amber-200 text-amber-600 hover:bg-amber-50 cursor-not-allowed"
                disabled>
                <Lock className="size-3" /> Em Breve
              </Button>
            ) : (
              <Button size="sm"
                className="h-7 text-xs gap-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                onClick={() => onInstall?.(integration)}>
                <Plus className="size-3" /> Instalar
              </Button>
            )}
            {integration.connectUrl && (
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
