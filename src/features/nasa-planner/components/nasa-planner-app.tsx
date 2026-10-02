"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon, BrainCircuitIcon, FileImageIcon,
  LayoutGridIcon, CalendarIcon, AlertCircleIcon, RocketIcon, LayoutDashboardIcon,
} from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { useNasaPlanner } from "../hooks/use-nasa-planner";
import { DashboardTab } from "./tabs/dashboard-tab";
import { PostsTab } from "./tabs/posts-tab";
import { MindMapsTab } from "./tabs/mind-maps-tab";
import { CalendarTab } from "./tabs/calendar-tab";
import { CampaignsTab } from "./tabs/campaigns-tab";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";

const TAB_TRIGGER_CLASS = "px-3 text-sm";

export function NasaPlannerApp({ plannerId }: { plannerId: string }) {
  const router = useRouter();
  const { planner, isLoading } = useNasaPlanner(plannerId);
  const [activeTab, setActiveTab] = useState("dashboard");

  useRegisterOrbitDock({
    leftItems: [
      { label: "Painel", icon: <LayoutDashboardIcon />, onSelect: () => setActiveTab("dashboard") },
      { label: "Campanhas", icon: <RocketIcon />, onSelect: () => setActiveTab("campaigns") },
    ],
    rightItems: [
      { label: "Posts", icon: <FileImageIcon />, onSelect: () => setActiveTab("posts") },
      { label: "Calendário", icon: <CalendarIcon />, onSelect: () => setActiveTab("calendar") },
    ],
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  }

  if (!planner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircleIcon className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Planner não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 shrink-0">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push("/nasa-planner")}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="size-8 rounded-lg bg-info flex items-center justify-center shrink-0">
          <BrainCircuitIcon className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-base leading-tight line-clamp-1">{planner.name}</h1>
          {planner.brandName && <p className="text-xs text-muted-foreground">{planner.brandName}</p>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="px-6 pb-2 shrink-0 overflow-x-auto">
          <TabsList>
            <TabsTrigger value="dashboard" className={TAB_TRIGGER_CLASS}>Dashboard</TabsTrigger>
            <TabsTrigger value="campaigns" className={TAB_TRIGGER_CLASS}>
              <RocketIcon className="size-3.5 mr-1.5" />Campanhas
            </TabsTrigger>
            <TabsTrigger
              value="posts"
              className={TAB_TRIGGER_CLASS}
              data-guide={GUIDE_ANCHORS.plannerPostsTab.id}
            >
              <FileImageIcon className="size-3.5 mr-1.5" />Posts
            </TabsTrigger>
            <TabsTrigger value="mindmaps" className={TAB_TRIGGER_CLASS}>
              <LayoutGridIcon className="size-3.5 mr-1.5" />Mapas Mentais
            </TabsTrigger>
            <TabsTrigger value="calendar" className={TAB_TRIGGER_CLASS}>
              <CalendarIcon className="size-3.5 mr-1.5" />Calendário de Ações
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-auto mt-0">
          <DashboardTab plannerId={plannerId} />
        </TabsContent>
        <TabsContent value="campaigns" className="flex-1 min-h-0 overflow-hidden mt-0">
          <CampaignsTab plannerId={plannerId} />
        </TabsContent>
        <TabsContent value="posts" className="flex-1 min-h-0 overflow-hidden mt-0">
          <PostsTab plannerId={plannerId} />
        </TabsContent>
        <TabsContent value="mindmaps" className="flex-1 min-h-0 overflow-hidden mt-0">
          <MindMapsTab plannerId={plannerId} />
        </TabsContent>
        <TabsContent value="calendar" className="flex-1 min-h-0 overflow-hidden mt-0">
          <CalendarTab plannerId={plannerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
