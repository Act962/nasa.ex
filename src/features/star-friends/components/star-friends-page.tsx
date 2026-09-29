"use client";

import { TiersAndRules } from "./tiers-and-rules";
import { StarFriendsOverview } from "./star-friends-overview";
import { useState } from "react";
import { Plus, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="size-6 text-amber-500" /> {program?.name ?? "STAR FRIENDS"}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                program?.isActive ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground",
              )}
            >
              ● {program?.isActive ? "Ativo" : "Pausado"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {program?.isActive
              ? `${program.starsPerPurchase} ⭐ por compra paga${program.minPurchaseAmount > 0 ? ` acima de R$ ${program.minPurchaseAmount}` : ""}${program.starsExpireDays ? ` · ⭐ valem ${program.starsExpireDays} dias` : ""}`
              : "Programa pausado — nenhuma star nova é gerada, os saldos continuam valendo."}
          </p>
        </div>
        {permissions.canConfigure && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveTab("settings")}>
              <Settings className="size-4" /> Configurações
            </Button>
            <Button onClick={() => setActiveTab("rewards")}>
              <Plus className="size-4" /> Novo prêmio
            </Button>
          </div>
        )}
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="redemptions">Resgates{stats.pendingRedemptions > 0 ? ` (${stats.pendingRedemptions})` : ""}</TabsTrigger>
          <TabsTrigger value="rewards">Cartões e prêmios</TabsTrigger>
          <TabsTrigger value="members">Participantes</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="tiers">Níveis e regras</TabsTrigger>
          {permissions.canConfigure && <TabsTrigger value="settings">Configurações</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <StarFriendsOverview onNavigate={setActiveTab} />
        </TabsContent>
        <TabsContent value="tiers" className="pt-4">
          <TiersAndRules canEdit={permissions.canConfigure} />
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
