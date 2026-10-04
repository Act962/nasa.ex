"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MegaphoneIcon, MessageCircleIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { integrations as CATALOG_INTEGRATIONS } from "@/data/integrations";
import { AstroMark } from "@/features/astro/components/astro-mark";
import { useAstroAiMode } from "@/features/astro/hooks/use-astro-ai-mode";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useMarketplace } from "@/features/integrations/context/marketplace-context";
import {
  ConfigDialog,
  PLATFORM_DEFS,
  type PlatformDef,
} from "@/features/integrations/components/integrations-page";
import { MetaMcpSection } from "@/features/integrations/components/meta-mcp-section";
import { ExternalAiSection } from "@/features/external-ai/components/external-ai-section";
import {
  useChannelOrbit,
  useDeletePlatformIntegration,
  useQueryPlatformIntegrations,
  useUpsertPlatformIntegration,
} from "@/features/integrations/hooks/use-integrations";
import type { IntegrationPlatform } from "@/generated/prisma/enums";
import { useOrgRole } from "@/hooks/use-org-role";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActivePlatformCard, AvailablePlatformCard, CatalogSatelliteCard } from "./satellite-cards";
import {
  groupCatalogIntegrations,
  groupPlatformDefs,
  matchesSearch,
  normalizeSearch,
} from "./satellite-groups";
import { AppReportButton } from "@/features/insights/components/app-report-button";
import { useOrganizationAiCredits } from "@/features/ai-credits/hooks/use-ai-credits";
import { OrganizationAiCreditStrip } from "@/features/ai-credits/components/organization-ai-credit-strip";
import type { AiCreditProvider } from "@/features/ai-credits/lib/ai-credit-types";

const ORBIT_SECTION_ID = "satellites-orbit";

function scrollToSatelliteSection(sectionId: string) {
  const section = document.getElementById(sectionId) ?? document.getElementById(ORBIT_SECTION_ID);
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Página de Satélites (antigas Integrações): o que já orbita o ASTRO e o que dá para ativar, por tipo. */
const AI_PLATFORM_TO_CREDIT_PROVIDER: Record<string, AiCreditProvider> = {
  OPENAI: "openai",
  GEMINI: "google",
  ANTHROPIC: "anthropic",
};

export function SatellitesHub() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSingle } = useOrgRole();
  const canManage = !isSingle;
  const { installedSlugs } = useMarketplace();
  const { data } = useQueryPlatformIntegrations();
  const { data: aiModeData } = useAstroAiMode();
  const { data: channelOrbit } = useChannelOrbit();
  const { data: organizationAiCredits } = useOrganizationAiCredits();
  const upsertIntegration = useUpsertPlatformIntegration();
  const deleteIntegration = useDeletePlatformIntegration();
  const [searchText, setSearchText] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  // `?connect=OPENAI` abre direto a configuração do satélite (cartão do ASTRO, spec 0053).
  const [configuring, setConfiguring] = useState<PlatformDef | null>(() => {
    const requestedPlatform = searchParams.get("connect")?.toUpperCase();
    return PLATFORM_DEFS.find((platformDef) => platformDef.platform === requestedPlatform) ?? null;
  });
  const [disconnecting, setDisconnecting] = useState<IntegrationPlatform | null>(null);

  const integrationRows = data?.integrations ?? [];
  const activeRowByPlatform = new Map(
    integrationRows.filter((row) => row.isActive).map((row) => [String(row.platform), row]),
  );
  const orbitaProvidedPlatforms = new Set(aiModeData?.platformAiPlatforms ?? []);
  // WhatsApp e Instagram entram em órbita pelo canal real: instância conectada / conta ativa no Comments.
  const isWhatsAppConnected = channelOrbit?.isWhatsAppConnected ?? false;
  const isInstagramConnected = channelOrbit?.isInstagramConnected ?? false;
  const CHANNEL_CATALOG_STATUS: Record<string, boolean> = {
    "whatsapp-business": isWhatsAppConnected,
    "instagram-dm": isInstagramConnected,
  };
  const isPlatformActive = (platformDef: PlatformDef) =>
    (platformDef.platform === "WHATSAPP" && isWhatsAppConnected) ||
    (platformDef.platform === "INSTAGRAM" && isInstagramConnected) ||
    activeRowByPlatform.has(platformDef.platform) ||
    orbitaProvidedPlatforms.has(platformDef.platform);

  // Só a IA conectada com a chave da própria empresa mostra consumo e saldo; a mantida pelo ÓRBITA não (spec 0055, RF-9).
  const renderAiCreditFooter = (platformDef: PlatformDef) => {
    const provider = AI_PLATFORM_TO_CREDIT_PROVIDER[platformDef.platform];
    if (!provider || !activeRowByPlatform.has(platformDef.platform)) return undefined;
    const summary = organizationAiCredits?.providers.find((providerSummary) => providerSummary.provider === provider);
    return summary ? <OrganizationAiCreditStrip summary={summary} canManage={canManage} /> : undefined;
  };

  const search = normalizeSearch(searchText);
  const isCatalogInstalled = (slug: string, status: string) =>
    slug in CHANNEL_CATALOG_STATUS
      ? CHANNEL_CATALOG_STATUS[slug]
      : status === "installed" || installedSlugs.has(slug);

  const activePlatformDefs = PLATFORM_DEFS.filter(isPlatformActive).filter((platformDef) =>
    matchesSearch(search, platformDef.label, platformDef.description),
  );
  const activeCatalog = CATALOG_INTEGRATIONS.filter(
    (integration) =>
      isCatalogInstalled(integration.slug, integration.status) &&
      matchesSearch(search, integration.name, integration.description),
  );
  const availablePlatformGroups = groupPlatformDefs(
    PLATFORM_DEFS.filter(
      (platformDef) =>
        !isPlatformActive(platformDef) && matchesSearch(search, platformDef.label, platformDef.description),
    ),
  );
  const availableCatalogGroups = groupCatalogIntegrations(
    CATALOG_INTEGRATIONS.filter(
      (integration) =>
        !isCatalogInstalled(integration.slug, integration.status) &&
        matchesSearch(search, integration.name, integration.description, ...integration.tags),
    ),
  );
  const orbitCount = activePlatformDefs.length + activeCatalog.length;
  const hasNoResults =
    orbitCount === 0 && availablePlatformGroups.length === 0 && availableCatalogGroups.length === 0;

  const focusSearch = () => {
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInputRef.current?.focus({ preventScroll: true });
  };

  // No celular o dock leva direto aos tipos de satélite mais usados.
  useRegisterOrbitDock({
    leftItems: [
      { label: "IA", icon: <SparklesIcon />, onSelect: () => scrollToSatelliteSection("platform-ai") },
      { label: "Mensagens", icon: <MessageCircleIcon />, onSelect: () => scrollToSatelliteSection("platform-messaging") },
    ],
    rightItems: [
      { label: "Anúncios", icon: <MegaphoneIcon />, onSelect: () => scrollToSatelliteSection("platform-ads") },
      { label: "Buscar", icon: <SearchIcon />, onSelect: focusSearch },
    ],
  });

  const saveConfiguration = (config: Record<string, string>) => {
    if (!configuring || configuring.platform === "WHATSAPP") return;
    upsertIntegration.mutate(
      { platform: configuring.platform as IntegrationPlatform, config, isActive: true },
      { onSuccess: () => setConfiguring(null) },
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="dark relative overflow-hidden rounded-[28px] bg-background px-5 py-7 text-foreground sm:px-8">
        <div className="pointer-events-none absolute -top-16 right-0 size-64 rounded-full bg-info/20 blur-[90px]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-blue-700 shadow-[0_0_30px_rgba(37,99,235,0.45)]">
            <AstroMark className="size-full" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Satélites</h1>
              <AppReportButton appModule="integrations" variant="secondary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Apps que orbitam o ASTRO. Cada satélite ativo amplia o que ele sabe e consegue fazer por você.
            </p>
          </div>
          <p className="text-sm text-muted-foreground sm:text-right">
            <span className="block text-2xl font-semibold text-foreground">{orbitCount}</span>
            em órbita
          </p>
        </div>
        <label className="relative mt-5 flex items-center">
          <SearchIcon className="pointer-events-none absolute left-4 size-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar satélite: Meta, Google, OpenAI…"
            data-guide={GUIDE_ANCHORS.integrationsSearch.id}
            className="h-11 w-full rounded-full bg-card/80 pr-4 pl-11 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </header>

      {orbitCount > 0 && (
        <section id={ORBIT_SECTION_ID} className="scroll-mt-16 space-y-3">
          <h2 className="px-1 text-sm font-semibold">Em órbita</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activePlatformDefs.map((platformDef) => (
              <ActivePlatformCard
                key={platformDef.platform}
                platformDef={platformDef}
                errorMessage={activeRowByPlatform.get(platformDef.platform)?.lastErrorMessage}
                isProvidedByOrbita={
                  orbitaProvidedPlatforms.has(platformDef.platform) &&
                  !activeRowByPlatform.has(platformDef.platform)
                }
                canManage={canManage}
                onConfigure={() => setConfiguring(platformDef)}
                onDisconnect={() => setDisconnecting(platformDef.platform as IntegrationPlatform)}
                footer={renderAiCreditFooter(platformDef)}
              />
            ))}
            {activeCatalog.map((integration) => (
              <CatalogSatelliteCard key={integration.slug} integration={integration} isInstalled />
            ))}
          </div>
        </section>
      )}

      {availablePlatformGroups.map((group) => (
        <section key={group.key} id={group.key} className="scroll-mt-16 space-y-3">
          <h2 className="px-1 text-sm font-semibold">
            {group.label} <span className="font-normal text-muted-foreground">· {group.items.length}</span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.items.map((platformDef) => (
              <AvailablePlatformCard
                key={platformDef.platform}
                platformDef={platformDef}
                canManage={canManage}
                onActivate={() =>
                  platformDef.platform === "WHATSAPP"
                    ? router.push(platformDef.docsUrl)
                    : setConfiguring(platformDef)
                }
              />
            ))}
          </div>
        </section>
      ))}

      {availableCatalogGroups.length > 0 && (
        <div className="space-y-6">
          <h2 className="px-1 text-base font-semibold">Mais satélites para ativar</h2>
          {availableCatalogGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h3 className="px-1 text-sm font-medium text-muted-foreground">
                {group.label} · {group.items.length}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((integration) => (
                  <CatalogSatelliteCard key={integration.slug} integration={integration} isInstalled={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {hasNoResults && (
        <p className="rounded-[24px] bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum satélite encontrado para “{searchText}”.
        </p>
      )}

      <MetaMcpSection />
      <ExternalAiSection />

      {configuring && configuring.platform !== "WHATSAPP" && (
        <ConfigDialog
          def={configuring}
          existing={
            (activeRowByPlatform.get(configuring.platform)?.config as Record<string, string> | undefined) ?? {}
          }
          open
          onClose={() => setConfiguring(null)}
          onSave={saveConfiguration}
          isSaving={upsertIntegration.isPending}
        />
      )}

      <AlertDialog open={Boolean(disconnecting)} onOpenChange={(isOpen) => !isOpen && setDisconnecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar satélite de órbita</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados já coletados continuam salvos, mas o ASTRO deixa de usar este satélite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (disconnecting) {
                  deleteIntegration.mutate({ platform: disconnecting }, { onSuccess: () => setDisconnecting(null) });
                }
              }}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
