"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon, BrainCircuitIcon, FileImageIcon,
  LayoutGridIcon, CalendarIcon, SettingsIcon, AlertCircleIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { useNasaPlanner } from "../hooks/use-nasa-planner";
import { DashboardTab } from "./tabs/dashboard-tab";
import { PostsTab } from "./tabs/posts-tab";
import { MindMapsTab } from "./tabs/mind-maps-tab";
import { CalendarTab } from "./tabs/calendar-tab";
import { SettingsTab } from "./tabs/settings-tab";

const TAB_TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-violet-600 data-[state=active]:text-violet-600 data-[state=active]:bg-transparent px-3 py-2 text-sm";

export function NasaPlannerApp({ plannerId }: { plannerId: string }) {
  const router = useRouter();
  const { planner, isLoading } = useNasaPlanner(plannerId);
  const [activeTab, setActiveTab] = useState("dashboard");

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  }

  if (!planner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircleIcon className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">Planner não encontrado.</p>
        <Button variant="outline" onClick={() => router.push("/nasa-planner")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push("/nasa-planner")}>
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div className="size-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center shrink-0">
          <BrainCircuitIcon className="size-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-base leading-tight line-clamp-1">{planner.name}</h1>
          {planner.brandName && <p className="text-xs text-muted-foreground">{planner.brandName}</p>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="border-b px-6 shrink-0">
          <TabsList className="h-10 rounded-none bg-transparent p-0 gap-1">
            <TabsTrigger value="dashboard" className={TAB_TRIGGER_CLASS}>Dashboard</TabsTrigger>
            <TabsTrigger value="posts" className={TAB_TRIGGER_CLASS}>
              <FileImageIcon className="size-3.5 mr-1.5" />Posts
            </TabsTrigger>
            <TabsTrigger value="mindmaps" className={TAB_TRIGGER_CLASS}>
              <LayoutGridIcon className="size-3.5 mr-1.5" />Mapas Mentais
            </TabsTrigger>
            <TabsTrigger value="calendar" className={TAB_TRIGGER_CLASS}>
              <CalendarIcon className="size-3.5 mr-1.5" />Calendário
            </TabsTrigger>
            <TabsTrigger value="settings" className={TAB_TRIGGER_CLASS}>
              <SettingsIcon className="size-3.5 mr-1.5" />Configurações
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="flex-1 min-h-0 overflow-auto mt-0">
          <DashboardTab plannerId={plannerId} />
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
        <TabsContent value="settings" className="flex-1 min-h-0 overflow-hidden mt-0">
          <SettingsTab plannerId={plannerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
