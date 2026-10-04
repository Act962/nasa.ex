"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { BellRingIcon, LayoutDashboardIcon, Plus, ShieldCheckIcon, TerminalSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { openCreateCommand } from "@/features/astro-commander/lib/open-create-command";
import { ASTRO_COMMAND_EXAMPLES } from "@/features/astro-commander/lib/command-examples";
import { AstroBotSettings } from "@/features/astro-bot/components/astro-bot-settings";
import { WhatsAppNotificationPreferences } from "@/features/astro-commander/components/whatsapp-notification-preferences";
import { CommandsTab } from "@/features/astro-commander/components/tabs/commands-tab";
import { OverviewTab } from "@/features/astro-commander/components/tabs/overview-tab";
import { ApprovalsTab } from "@/features/astro-commander/components/tabs/approvals-tab";
import { AutomationsTab } from "@/features/alerts/components/automations-tab";
import { AutoIntelligenceTab } from "@/features/astro-commander/components/tabs/auto-intelligence-tab";
import { SessionsTab } from "@/features/astro-commander/components/tabs/sessions-tab";
import { PermissionsTab } from "@/features/astro-commander/components/tabs/permissions-tab";
import { FullscreenControls } from "@/components/fullscreen-controls/fullscreen-controls";

/**
 * App ASTRO (spec 0028, RF-9 / RF-10). O ASTRO é o único assistente; o que se
 * cria e configura aqui são COMANDOS.
 *
 * A aba ativa vive na URL (`?aba=`) para que o link possa ser compartilhado e
 * o F5 não jogue o usuário de volta na primeira aba.
 */

const TABS = [
  { value: "comandos", label: "Comandos" },
  { value: "visao-geral", label: "Visão geral" },
  { value: "alertas", label: "Alertas" },
  { value: "aprovacoes", label: "Aprovações" },
  { value: "auto-inteligencia", label: "Auto Inteligência" },
  { value: "sessoes", label: "Sessões" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "permissoes", label: "Permissões" },
] as const;

const DEFAULT_TAB = "comandos";

export function AstroAppShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("aba") ?? DEFAULT_TAB;
  const activeTab = TABS.some((tab) => tab.value === requested)
    ? requested
    : DEFAULT_TAB;

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("aba", value);
      router.replace(`/astro?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useRegisterOrbitDock({
    leftItems: [
      { label: "Comandos", icon: <TerminalSquareIcon />, onSelect: () => handleTabChange("comandos"), isActive: activeTab === "comandos" },
      { label: "Visão geral", icon: <LayoutDashboardIcon />, onSelect: () => handleTabChange("visao-geral"), isActive: activeTab === "visao-geral" },
    ],
    rightItems: [
      { label: "Aprovações", icon: <ShieldCheckIcon />, onSelect: () => handleTabChange("aprovacoes"), isActive: activeTab === "aprovacoes" },
      { label: "Alertas", icon: <BellRingIcon />, onSelect: () => handleTabChange("alertas"), isActive: activeTab === "alertas" },
    ],
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Mesmo cabeçalho de /contatos: identificação à esquerda, ação à direita.
          Antes a página abria direto nas abas, com a busca e os botões soltos
          no meio do conteúdo. */}
      <header className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-sm font-medium">ASTRO</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              openCreateCommand({ examples: [...ASTRO_COMMAND_EXAMPLES.astro] })
            }
          >
            <Plus className="size-4" />
            Criar comando
          </Button>
          <FullscreenControls />
        </div>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="max-w-full overflow-x-auto px-4 pb-1">
          <TabsList className="justify-start">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-none">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="comandos" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <CommandsTab />
        </TabsContent>
        <TabsContent value="visao-geral" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="alertas" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {/* O que o ASTRO vigia e avisa. Vinha de /settings/notifications, onde
              ninguém ligava a regra ao aviso que aparece no widget. */}
          <div className="max-w-4xl">
            <AutomationsTab />
          </div>
        </TabsContent>
        <TabsContent value="aprovacoes" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <ApprovalsTab />
        </TabsContent>
        <TabsContent value="auto-inteligencia" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <AutoIntelligenceTab />
        </TabsContent>
        <TabsContent value="sessoes" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="whatsapp" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {/* Mesma seção que vivia em /settings/astro-bot, sem perda de função. */}
          <div className="max-w-3xl space-y-8">
            <AstroBotSettings />
            <WhatsAppNotificationPreferences />
          </div>
        </TabsContent>
        <TabsContent value="permissoes" className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
