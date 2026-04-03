"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Flame, Settings } from "lucide-react";
import { ToastProvider } from "@/contexts/toast-context";
import { ForgeDashboard } from "./dashboard/forge-dashboard";
import { ProductsTab } from "./products/products-tab";
import { ProposalsTab } from "./proposals/proposals-tab";
import { ContractsTab } from "./contracts/contracts-tab";
import { ForgeSettingsPanel } from "./settings/forge-settings";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StarsWidget } from "@/features/stars";
import { SpacePointWidget } from "@/features/space-point";

export function ForgePage() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="h-full w-full flex flex-col">
      {/* Top header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#7C3AED] flex items-center justify-center shadow-sm">
            <Flame className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-tight">FORGE</h1>
            <p className="text-xs text-muted-foreground">Propostas comerciais & contratos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SpacePointWidget />
          <StarsWidget />
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setSettingsOpen(true)}
            title="Configurações do FORGE"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 border-b shrink-0">
          <TabsList className="h-9">
            <TabsTrigger value="dashboard" className="text-xs gap-1.5">
              📊 Painel
            </TabsTrigger>
            <TabsTrigger value="products" className="text-xs gap-1.5">
              📦 Produtos
            </TabsTrigger>
            <TabsTrigger value="proposals" className="text-xs gap-1.5">
              📄 Propostas
            </TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs gap-1.5">
              📋 Contratos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="dashboard" className="px-6 py-6 mt-0">
            <ForgeDashboard />
          </TabsContent>
          <TabsContent value="products" className="px-6 py-6 mt-0">
            <ProductsTab />
          </TabsContent>
          <TabsContent value="proposals" className="px-6 py-6 mt-0">
            <ProposalsTab />
          </TabsContent>
          <TabsContent value="contracts" className="px-6 py-6 mt-0">
            <ContractsTab />
          </TabsContent>
        </div>
      </Tabs>

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="size-4" /> Configurações do FORGE
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ForgeSettingsPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </ToastProvider>
  );
}
