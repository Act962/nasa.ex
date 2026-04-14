"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Settings, Landmark } from "lucide-react";
import { StarsWidget } from "@/features/stars";
import { SpacePointWidget } from "@/features/space-point";
import { PaymentDashboard } from "./dashboard/payment-dashboard";
import { EntriesTable } from "./entries/entries-table";
import { CashflowTab } from "./cashflow/cashflow-tab";
import { ContactsTab } from "./contacts/contacts-tab";
import { PaymentSettings } from "./settings/payment-settings";
import { HeaderTracking } from "@/features/leads/components/header-tracking";

export function PaymentPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <HeaderTracking title="Payment" />
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1E90FF] flex items-center justify-center shadow-sm">
            <Landmark className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-tight">
              PAYMENT
            </h1>
            <p className="text-xs text-muted-foreground">
              Gestão financeira completa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setSettingsOpen(true)}
            title="Configurações do Payment"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-4 shrink-0 w-full overflow-x-auto">
          <TabsList className="h-9">
            <TabsTrigger value="dashboard" className="text-xs gap-1.5">
              📊 Painel
            </TabsTrigger>
            <TabsTrigger value="receivables" className="text-xs gap-1.5">
              💚 A Receber
            </TabsTrigger>
            <TabsTrigger value="payables" className="text-xs gap-1.5">
              🔴 A Pagar
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="text-xs gap-1.5">
              📈 Fluxo de Caixa
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs gap-1.5">
              👥 Contatos
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="dashboard" className="px-6 py-6 mt-0">
            <PaymentDashboard />
          </TabsContent>
          <TabsContent value="receivables" className="px-6 py-6 mt-0">
            <EntriesTable type="RECEIVABLE" />
          </TabsContent>
          <TabsContent value="payables" className="px-6 py-6 mt-0">
            <EntriesTable type="PAYABLE" />
          </TabsContent>
          <TabsContent value="cashflow" className="px-6 py-6 mt-0">
            <CashflowTab />
          </TabsContent>
          <TabsContent value="contacts" className="px-6 py-6 mt-0">
            <ContactsTab />
          </TabsContent>
        </div>
      </Tabs>

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="size-4" /> Configurações do Payment
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <PaymentSettings />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
