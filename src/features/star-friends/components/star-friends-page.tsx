"use client";

import { useState } from "react";
import { Gift, Hourglass, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type StarFriendsHistoryFilters, useStarFriendsOverview } from "../hooks/use-star-friends";
import { InstallStarFriends } from "./install-star-friends";
import { useStarFriendsPermissions } from "../hooks/use-star-friends-permissions";
import { ProgramSettingsForm } from "./program-settings-form";
import { RewardsManager } from "./rewards-manager";
import { MembersList } from "./members-list";
import { RedemptionsQueue } from "./redemptions-queue";
import { HistoryAudit } from "./history-audit";

export function StarFriendsPage() {
  const overview = useStarFriendsOverview();
  const [activeTab, setActiveTab] = useState("overview");
  const [historyFilters, setHistoryFilters] = useState<StarFriendsHistoryFilters>({});
  const permissions = useStarFriendsPermissions();

  if (overview.isLoading || permissions.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!permissions.canView) {
    return (
      <p className="text-sm text-muted-foreground">
        Seu papel não tem acesso ao STAR FRIENDS. O Master libera em Configurações → Permissões.
      </p>
    );
  }
  if (!overview.data?.isInstalled) return <InstallStarFriends canInstall={permissions.canConfigure} />;

  const { stats, program } = overview.data;
  const statCards = [
    { label: "Participantes", value: stats.membersCount, icon: Users },
    { label: "Stars em circulação", value: stats.starsInCirculation, icon: Sparkles },
    { label: "Resgates aguardando", value: stats.pendingRedemptions, icon: Hourglass },
    { label: "Prêmios entregues", value: stats.deliveredRedemptions, icon: Gift },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="size-6 text-amber-500" /> {program?.name ?? "STAR FRIENDS"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {program?.isActive
            ? `Ativo · ${program.starsPerPurchase} star por compra paga${program.minPurchaseAmount > 0 ? ` acima de R$ ${program.minPurchaseAmount}` : ""}`
            : "Programa pausado — nenhuma star nova é gerada, os saldos continuam valendo."}
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="redemptions">Resgates{stats.pendingRedemptions > 0 ? ` (${stats.pendingRedemptions})` : ""}</TabsTrigger>
          <TabsTrigger value="rewards">Lista de troca</TabsTrigger>
          <TabsTrigger value="members">Participantes</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          {permissions.canConfigure && <TabsTrigger value="settings">Configurações</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview" className="flex flex-col gap-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <stat.icon className="size-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Como funciona</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>1. Pedido pago no Catálogo online ou proposta do Forge marcada como paga gera star automaticamente.</p>
              <p>2. O consultor pode lançar ou retirar stars nos Detalhes do lead (aba Produtos/Serviços), sempre com motivo.</p>
              <p>3. O cliente troca pelo consultor, pelo botão &quot;+&quot; do chat, pelo Astro ou pela página do pedido.</p>
              <p>4. Pedidos do Astro e do portal esperam aprovação em &quot;Resgates&quot;. Tudo aparece no &quot;Histórico&quot;.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="redemptions" className="pt-4">
          <RedemptionsQueue />
        </TabsContent>
        <TabsContent value="rewards" className="pt-4">
          <RewardsManager canEdit={permissions.canConfigure} />
        </TabsContent>
        <TabsContent value="members" className="pt-4">
          <MembersList
            onOpenHistory={(memberId) => {
              setHistoryFilters({ memberId });
              setActiveTab("history");
            }}
          />
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <HistoryAudit filters={historyFilters} onFiltersChange={setHistoryFilters} />
        </TabsContent>
        <TabsContent value="settings" className="pt-4">
          <ProgramSettingsForm program={program} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
