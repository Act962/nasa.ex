"use client";

import { TiersAndRules } from "./tiers-and-rules";
import { StarFriendsOverview } from "./star-friends-overview";
import { useState } from "react";
import { Award, Gift, LayoutDashboard, Plus, Settings, Sparkles, Users } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
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
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { AppReportButton } from "@/features/insights/components/app-report-button";

export function StarFriendsPage() {
  const overview = useStarFriendsOverview();
  const [activeTab, setActiveTab] = useState("overview");
  const [historyFilters, setHistoryFilters] = useState<StarFriendsHistoryFilters>({});
  const permissions = useStarFriendsPermissions();
  const pendingRedemptionsCount = overview.data?.stats?.pendingRedemptions ?? 0;

  // Celular: as quatro seções do dia a dia ficam no menu de baixo, com o ASTRO no centro.
  useRegisterOrbitDock({
    leftItems: [
      { label: "Início", icon: <LayoutDashboard />, onSelect: () => setActiveTab("overview"), isActive: activeTab === "overview" },
      {
        label: "Resgates",
        icon: <Gift />,
        onSelect: () => setActiveTab("redemptions"),
        isActive: activeTab === "redemptions",
        badgeCount: pendingRedemptionsCount,
      },
    ],
    rightItems: [
      { label: "Prêmios", icon: <Award />, onSelect: () => setActiveTab("rewards"), isActive: activeTab === "rewards" },
      { label: "Participantes", icon: <Users />, onSelect: () => setActiveTab("members"), isActive: activeTab === "members" },
    ],
  });

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

  const ruleSummary = program?.isActive
    ? `${program.starsPerPurchase} stars por compra paga${program.minPurchaseAmount > 0 ? ` acima de R$ ${program.minPurchaseAmount}` : ""}${program.starsExpireDays ? ` · valem ${program.starsExpireDays} dias` : ""}`
    : "Programa pausado — nenhuma star nova é gerada, os saldos continuam valendo.";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-bold tracking-tight md:text-2xl">
              <span className="truncate">{program?.name ?? "STAR FRIENDS"}</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  program?.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full", program?.isActive ? "bg-success" : "bg-muted-foreground")} />
                {program?.isActive ? "Ativo" : "Pausado"}
              </span>
            </h1>
            <p className="line-clamp-2 text-xs text-muted-foreground md:text-sm">{ruleSummary}</p>
          </div>
        </div>
        {permissions.canConfigure && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full md:hidden"
              aria-label="Configurações"
              onClick={() => setActiveTab("settings")}
            >
              <Settings className="size-4" />
            </Button>
            <Button variant="outline" className="rounded-full max-md:hidden" onClick={() => setActiveTab("settings")}>
              <Settings className="size-4" /> Configurações
            </Button>
            <AppReportButton appModule="star-friends" size="default" isCompactOnMobile className="rounded-full max-sm:size-10" />
            <Button className="rounded-full max-md:hidden" onClick={() => setActiveTab("rewards")}>
              <Plus className="size-4" /> Novo prêmio
            </Button>
          </div>
        )}
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Uma linha que rola para o lado (no celular as principais também estão no menu de baixo). */}
        <div className="scroll-hidden-x -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="h-10 w-max">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="redemptions" className="gap-1.5">
              Resgates
              {stats.pendingRedemptions > 0 && (
                <span className="min-w-5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">{stats.pendingRedemptions}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rewards" data-guide={GUIDE_ANCHORS.starFriendsRewardsTab.id}>
              Cartões e prêmios
            </TabsTrigger>
            <TabsTrigger value="members">Participantes</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="tiers">Níveis e regras</TabsTrigger>
            {permissions.canConfigure && <TabsTrigger value="settings">Configurações</TabsTrigger>}
          </TabsList>
        </div>
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
