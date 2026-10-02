"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, ChevronRightIcon, PlusIcon, Settings2Icon, UnplugIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import type { PlatformDef } from "@/features/integrations/components/integrations-page";
import type { Integration } from "@/types/integration";
import { CATEGORY_ICONS } from "@/types/integration";

/** Cartões da página de Satélites: em órbita (ativos) e disponíveis para ativar. */

function PlatformIconCircle({ platformDef, isLarge }: { platformDef: PlatformDef; isLarge?: boolean }) {
  const PlatformIcon = platformDef.icon;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-knob", isLarge ? "size-12" : "size-10")}>
      <PlatformIcon className={isLarge ? "size-6" : "size-5"} />
    </span>
  );
}

function CatalogIconCircle({ integration }: { integration: Integration }) {
  const [hasImageFailed, setHasImageFailed] = useState(false);
  const isImageIcon = integration.icon.startsWith("http") && !hasImageFailed;
  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-knob text-lg">
      {isImageIcon ? (
        // eslint-disable-next-line @next/next/no-img-element -- favicons externos de domínios variados
        <img
          src={integration.icon}
          alt=""
          className="size-6 object-contain"
          onError={() => setHasImageFailed(true)}
        />
      ) : integration.icon.startsWith("http") ? (
        CATEGORY_ICONS[integration.category] ?? "🛰️"
      ) : (
        integration.icon
      )}
    </span>
  );
}

interface ActivePlatformCardProps {
  platformDef: PlatformDef;
  errorMessage?: string | null;
  isProvidedByOrbita?: boolean;
  canManage: boolean;
  onConfigure: () => void;
  onDisconnect: () => void;
  /** Conteúdo extra abaixo do estado, ex.: consumo e saldo da IA própria (spec 0055). */
  footer?: React.ReactNode;
}

export function ActivePlatformCard({
  platformDef,
  errorMessage,
  isProvidedByOrbita,
  canManage,
  onConfigure,
  onDisconnect,
  footer,
}: ActivePlatformCardProps) {
  const isWhatsApp = platformDef.platform === "WHATSAPP";
  return (
    <article className="flex flex-col gap-3 rounded-[24px] bg-card p-4">
      <div className="flex items-start gap-3">
        <PlatformIconCircle platformDef={platformDef} isLarge />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{platformDef.label}</h3>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", errorMessage ? "bg-destructive" : "bg-success")} />
            {errorMessage ? "Com problema" : isProvidedByOrbita ? "Mantido pelo ÓRBITA" : "Em órbita"}
          </p>
        </div>
      </div>
      {errorMessage && (
        <p className="flex items-start gap-1.5 rounded-[14px] bg-destructive/10 px-3 py-2 text-xs text-destructive [overflow-wrap:anywhere]">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          {errorMessage.length > 90 ? `${errorMessage.slice(0, 90)}…` : errorMessage}
        </p>
      )}
      {footer}
      {!isProvidedByOrbita && canManage && (
        <div className="mt-auto flex gap-2">
          {isWhatsApp ? (
            <Button asChild size="sm" variant="secondary" className="flex-1">
              <Link href={platformDef.docsUrl}>
                <Settings2Icon />
                Instâncias
              </Link>
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="flex-1" onClick={onConfigure}>
                <Settings2Icon />
                Configurar
              </Button>
              <Button size="icon" variant="ghost" className="size-8" aria-label="Desconectar" onClick={onDisconnect}>
                <UnplugIcon />
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function AvailablePlatformCard({
  platformDef,
  canManage,
  onActivate,
}: {
  platformDef: PlatformDef;
  canManage: boolean;
  onActivate: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-[20px] bg-card p-3">
      <PlatformIconCircle platformDef={platformDef} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{platformDef.label}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{platformDef.description}</p>
      </div>
      <Button
        size="sm"
        className="shrink-0"
        disabled={!canManage}
        onClick={onActivate}
        data-guide={GUIDE_ANCHORS.integrationsConnectButton.id}
      >
        <PlusIcon />
        Ativar
      </Button>
    </article>
  );
}

export function CatalogSatelliteCard({ integration, isInstalled }: { integration: Integration; isInstalled: boolean }) {
  return (
    <Link
      href={`/integrations/${integration.slug}`}
      className="flex items-center gap-3 rounded-[20px] bg-card p-3 transition-colors hover:bg-accent"
    >
      <CatalogIconCircle integration={integration} />
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-1.5 truncate text-sm font-medium">
          {integration.name}
          {isInstalled && <span className="size-1.5 shrink-0 rounded-full bg-success" aria-label="Em órbita" />}
        </h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{integration.description}</p>
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
