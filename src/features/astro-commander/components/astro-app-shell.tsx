"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AstroBotSettings } from "@/features/astro-bot/components/astro-bot-settings";
import { CommandsTab } from "@/features/astro-commander/components/tabs/commands-tab";
import { OverviewTab } from "@/features/astro-commander/components/tabs/overview-tab";
import { ApprovalsTab } from "@/features/astro-commander/components/tabs/approvals-tab";
import { AutoIntelligenceTab } from "@/features/astro-commander/components/tabs/auto-intelligence-tab";
import { SessionsTab } from "@/features/astro-commander/components/tabs/sessions-tab";
import { PermissionsTab } from "@/features/astro-commander/components/tabs/permissions-tab";

/**
 * App ASTRO (spec 0023, RF-9 / RF-10). O ASTRO é o único assistente; o que se
 * cria e configura aqui são COMANDOS.
 *
 * A aba ativa vive na URL (`?aba=`) para que o link possa ser compartilhado e
 * o F5 não jogue o usuário de volta na primeira aba.
 */

const TABS = [
  { value: "comandos", label: "Comandos" },
  { value: "visao-geral", label: "Visão geral" },
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

  return (
    <div className="flex flex-col gap-6 px-4 pb-10 pt-4 md:px-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/60 p-1.5 md:w-fit">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-xl px-4 py-2 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="comandos">
          <CommandsTab />
        </TabsContent>
        <TabsContent value="visao-geral">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="aprovacoes">
          <ApprovalsTab />
        </TabsContent>
        <TabsContent value="auto-inteligencia">
          <AutoIntelligenceTab />
        </TabsContent>
        <TabsContent value="sessoes">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          {/* Mesma seção que vivia em /settings/astro-bot, sem perda de função. */}
          <div className="max-w-3xl">
            <AstroBotSettings />
          </div>
        </TabsContent>
        <TabsContent value="permissoes">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
