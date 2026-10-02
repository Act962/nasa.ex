"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalculatorIcon, FileSignatureIcon, Flame, LayoutDashboardIcon, PackageIcon, ScrollTextIcon, Settings } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { ToastProvider } from "@/contexts/toast-context";
import { ForgeDashboard } from "./dashboard/forge-dashboard";
import { ProductsTab } from "./products/products-tab";
import { ProposalsTab } from "./proposals/proposals-tab";
import { ContractsTab } from "./contracts/contracts-tab";
import { SimulatorTab } from "./simulator/simulator-tab";
import { ForgeSettingsPanel } from "./settings/forge-settings";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StarsWidget } from "@/features/stars";
import { SpacePointWidget } from "@/features/space-point";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { ASTRO_COMMAND_EXAMPLES } from "@/features/astro-commander/lib/command-examples";
import { authClient } from "@/lib/auth-client";
import { useForgeRealtime } from "../hooks/use-forge-realtime";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { AppReportButton } from "@/features/insights/components/app-report-button";

const FORGE_SECTION_META: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "Painel", subtitle: "Resumo de propostas e contratos" },
  proposals: { title: "Propostas", subtitle: "Crie, envie e acompanhe" },
  contracts: { title: "Contratos", subtitle: "Assinaturas e vigências" },
  products: { title: "Produtos", subtitle: "Catálogo para as propostas" },
  simulator: { title: "Simulador", subtitle: "Monte simulações de preço" },
};

export function ForgePage() {
  // Propostas criadas ou alteradas pelo ASTRO aparecem sem recarregar (spec 0032).
  useForgeRealtime();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  // No celular as abas principais também ficam no dock em órbita.
  useRegisterOrbitDock({
    leftItems: [
      { label: "Painel", icon: <LayoutDashboardIcon />, onSelect: () => setActiveTab("dashboard"), isActive: activeTab === "dashboard" },
      { label: "Propostas", icon: <ScrollTextIcon />, onSelect: () => setActiveTab("proposals"), isActive: activeTab === "proposals" },
    ],
    rightItems: [
      { label: "Contratos", icon: <FileSignatureIcon />, onSelect: () => setActiveTab("contracts"), isActive: activeTab === "contracts" },
      { label: "Produtos", icon: <PackageIcon />, onSelect: () => setActiveTab("products"), isActive: activeTab === "products" },
    ],
  });
  const { data: session } = authClient.useSession();
  const isSystemAdmin = Boolean(
    (session?.user as { isSystemAdmin?: boolean } | undefined)?.isSystemAdmin,
  );

  return (
    <ToastProvider>
      <div className="h-full w-full flex flex-col">
      {/* Top header */}
      <HeaderTracking
        title="Forge"
        isTitleHidden
        astroCommand={{ examples: ASTRO_COMMAND_EXAMPLES.forge, isHiddenOnMobile: true }}
      />
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-2 pb-3 md:px-6 md:pt-6 md:pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info shadow-sm">
            <Flame className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            {/* Celular: o título é a seção atual (o menu de baixo troca de seção); computador: o nome do app. */}
            <h1 className="truncate text-xl leading-tight font-bold tracking-tight md:hidden">
              {FORGE_SECTION_META[activeTab]?.title ?? "Forge"}
            </h1>
            <h1 className="hidden text-lg leading-tight font-black tracking-tight md:block">FORGE</h1>
            <p className="truncate text-xs text-muted-foreground">
              <span className="md:hidden">{FORGE_SECTION_META[activeTab]?.subtitle ?? "Propostas comerciais e contratos"}</span>
              <span className="max-md:hidden">Propostas comerciais e contratos</span>
            </p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-10 shrink-0 rounded-full bg-knob md:size-9 md:bg-transparent"
          onClick={() => setSettingsOpen(true)}
          title="Configurações do FORGE"
          aria-label="Configurações do FORGE"
        >
          <Settings className="size-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        {/* No celular as seções ficam no menu de baixo; as abas ficam só no computador. */}
        <div className="shrink-0 overflow-x-auto px-6 pt-2 max-md:sr-only">
          <TabsList className="h-10">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
              <LayoutDashboardIcon className="size-3.5" /> Painel
            </TabsTrigger>
            <TabsTrigger value="proposals" className="gap-1.5 text-xs" data-guide={GUIDE_ANCHORS.forgeProposalsTab.id}>
              <ScrollTextIcon className="size-3.5" /> Propostas
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-1.5 text-xs">
              <FileSignatureIcon className="size-3.5" /> Contratos
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5 text-xs" data-guide={GUIDE_ANCHORS.forgeProductsTab.id}>
              <PackageIcon className="size-3.5" /> Produtos
            </TabsTrigger>
            {isSystemAdmin && (
              <TabsTrigger value="simulator" className="gap-1.5 text-xs">
                <CalculatorIcon className="size-3.5" /> Simulador
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="dashboard" className="mt-0 px-4 pt-1 pb-6 md:px-6 md:py-6">
            <ForgeDashboard />
          </TabsContent>
          <TabsContent value="products" className="mt-0 px-4 pt-1 pb-6 md:px-6 md:py-6">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="proposals" className="mt-0 px-4 pt-1 pb-6 md:px-6 md:py-6">
            <ProposalsTab />
          </TabsContent>
          <TabsContent value="contracts" className="mt-0 px-4 pt-1 pb-6 md:px-6 md:py-6">
            <ContractsTab />
          </TabsContent>
          {isSystemAdmin && (
            <TabsContent value="simulator" className="mt-0 px-4 pt-1 pb-6 md:px-6 md:py-6">
              <SimulatorTab />
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        {/* Sem w-full: a gaveta flutua a 8px da borda e já ocupa a largura certa (w-full passava da tela). */}
        <SheetContent side="right" className="overflow-x-hidden overflow-y-auto sm:max-w-xl">
          <SheetHeader className="flex-row flex-wrap items-center justify-between gap-2 pr-12">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="size-4" /> Configurações do FORGE
            </SheetTitle>
            <AppReportButton appModule="forge" />
          </SheetHeader>
          <ForgeSettingsPanel />
        </SheetContent>
      </Sheet>
    </div>
    </ToastProvider>
  );
}
