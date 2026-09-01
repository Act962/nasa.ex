"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowLeft, Settings, Landmark } from "lucide-react";
import { toast } from "sonner";
import { StarsWidget } from "@/features/stars";
import { SpacePointWidget } from "@/features/space-point";
import { PaymentDashboard } from "./dashboard/payment-dashboard";
import { EntriesTable } from "./entries/entries-table";
import { CashflowTab } from "./cashflow/cashflow-tab";
import { ContactsTab } from "./contacts/contacts-tab";
import { ContractsTab } from "./contracts/contracts-tab";
import { DocumentsTab } from "./attachments/documents-tab";
import { ProjectionTab } from "./projection/projection-tab";
import { AccountsTab } from "./accounts/accounts-tab";
import { DreTab } from "./reports/dre-tab";
import { DroTab } from "./reports/dro-tab";
import { PaymentSettings } from "./settings/payment-settings";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { ApprovalsTab } from "./approvals/approvals-tab";
import { GovernanceSettingsTab } from "./governance/governance-settings-tab";
import { DunningRulesTab } from "./dunning/dunning-rules-tab";
import { NerpFinancialToggle } from "./governance/nerp-financial-toggle";
import {
  usePendingApprovals,
  useCanApprovePayments,
} from "../hooks/use-payment-approvals";
import { useExportPaymentEntries } from "../hooks/use-payment";
import { buildEntriesCsv, downloadCsv } from "../lib/export-entries";
import { PaymentFilterBar } from "./shared/payment-filter-bar";
import { usePaymentFiltersStore } from "../store/use-payment-filters-store";
import {
  PaymentMobileMenu,
  type PaymentTabItem,
} from "./payment-mobile-menu";

const BASE_TABS: PaymentTabItem[] = [
  { value: "dashboard", label: "Painel", emoji: "📊" },
  { value: "receivables", label: "Receita", emoji: "💚" },
  { value: "payables", label: "Despesa", emoji: "🔴" },
  { value: "cashflow", label: "Fluxo de Caixa", emoji: "📈" },
  { value: "projection", label: "Projeção", emoji: "🔭" },
  { value: "dre", label: "DRE", emoji: "📄" },
  { value: "dro", label: "DRO", emoji: "🏭" },
  { value: "accounts", label: "Contas", emoji: "🏦" },
  { value: "contacts", label: "Contatos", emoji: "👥" },
  { value: "contracts", label: "Contratos Ativos", emoji: "📝" },
  { value: "documents", label: "Documentos", emoji: "📎" },
];

// Abas cujo conteúdo responde ao período e/ou às categorias. A Projeção entra
// só pela categoria: ela tem horizonte próprio (3/6/12 meses).
const FILTERED_TABS = new Set([
  "dashboard",
  "receivables",
  "payables",
  "cashflow",
  "projection",
  "dre",
  "dro",
]);

export function PaymentPage() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Controlada pra que "Ver todas" no painel possa saltar direto pra aba certa.
  const [activeTab, setActiveTab] = useState("dashboard");
  // O período agora mora no store compartilhado (uma barra para todas as
  // abas); aqui só é lido para o "Exportar", que existe na toolbar do painel
  // e no menu sanduíche do mobile.
  const period = usePaymentFiltersStore((state) => state.period);
  const categoryIds = usePaymentFiltersStore((state) => state.categoryIds);
  // Badge de pendências da aba Aprovações — só pra users com canApprove.
  const canApproveQuery = useCanApprovePayments();
  const pendingApprovals = usePendingApprovals();
  const showApprovalsTab = canApproveQuery.data?.canApprove ?? false;
  const pendingCount = pendingApprovals.data?.count ?? 0;

  const exportEntries = useExportPaymentEntries();

  const tabs: PaymentTabItem[] = showApprovalsTab
    ? [
        ...BASE_TABS,
        {
          value: "approvals",
          label: "Aprovações",
          emoji: "🛡️",
          badgeCount: pendingCount,
        },
      ]
    : BASE_TABS;

  const activeTabLabel =
    tabs.find((tab) => tab.value === activeTab)?.label ?? "Painel";

  const isOnDashboard = activeTab === "dashboard";

  // Volta um nível: de qualquer aba para o Painel; do Painel, sai do Payment.
  function handleBack() {
    if (isOnDashboard) {
      router.back();
      return;
    }
    setActiveTab("dashboard");
  }

  async function handleExport() {
    try {
      const result = await exportEntries.mutateAsync({
        dateFrom: period.from,
        dateTo: period.to,
        ...(categoryIds.length > 0 ? { categoryIds } : {}),
      });
      if (result.entries.length === 0) {
        toast.info("Nenhum lançamento no período selecionado.");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(
        `painel-financeiro-${stamp}.csv`,
        buildEntriesCsv(result.entries),
      );
      toast.success(`${result.entries.length} lançamentos exportados.`);
    } catch {
      toast.error("Não foi possível exportar os lançamentos.");
    }
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <HeaderTracking title="Payment" />
      {/* No mobile o título do módulo é redundante com o header do app — no
          lugar dele fica a aba atual e o menu sanduíche. */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-2 sm:pt-6 pb-2 sm:pb-4 border-b shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            onClick={handleBack}
            aria-label="Voltar"
            title={isOnDashboard ? "Voltar" : "Voltar para o Painel"}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="truncate text-sm font-semibold sm:hidden">
            {activeTabLabel}
          </span>
          <div className="hidden sm:flex items-center gap-2.5 min-w-0">
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
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="hidden size-8 sm:inline-flex"
            onClick={() => setSettingsOpen(true)}
            title="Configurações do Payment"
          >
            <Settings className="size-4" />
          </Button>
          <PaymentMobileMenu
            className="sm:hidden"
            tabs={tabs}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onOpenSettings={() => setSettingsOpen(true)}
            onExport={handleExport}
            isExporting={exportEntries.isPending}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* No mobile a navegação vive no menu sanduíche do header. */}
        <div className="hidden sm:block px-4 sm:px-6 pt-4 shrink-0 w-full">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 [&>*]:flex-none">
            <TabsTrigger value="dashboard" className="text-xs gap-1.5">
              📊 Painel
            </TabsTrigger>
            <TabsTrigger value="receivables" className="text-xs gap-1.5">
              💚 Receita
            </TabsTrigger>
            <TabsTrigger value="payables" className="text-xs gap-1.5">
              🔴 Despesa
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="text-xs gap-1.5">
              📈 Fluxo de Caixa
            </TabsTrigger>
            <TabsTrigger value="projection" className="text-xs gap-1.5">
              🔭 Projeção
            </TabsTrigger>
            <TabsTrigger value="dre" className="text-xs gap-1.5">
              📄 DRE
            </TabsTrigger>
            <TabsTrigger value="dro" className="text-xs gap-1.5">
              🏭 DRO
            </TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs gap-1.5">
              🏦 Contas
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs gap-1.5">
              👥 Contatos
            </TabsTrigger>
            <TabsTrigger value="contracts" className="text-xs gap-1.5">
              📝 Contratos Ativos
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs gap-1.5">
              📎 Documentos
            </TabsTrigger>
            {showApprovalsTab && (
              <TabsTrigger value="approvals" className="text-xs gap-1.5">
                🛡️ Aprovações
                {pendingCount > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 leading-4 font-semibold">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Barra única de filtros: mesma posição em toda aba que filtra por
            período/categoria. Abas que não filtram (Contas, Contatos,
            Contratos, Documentos, Aprovações) ficam de fora — controle inerte
            confunde mais do que ajuda. */}
        {FILTERED_TABS.has(activeTab) && (
          <PaymentFilterBar showPeriod={activeTab !== "projection"} />
        )}

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="dashboard" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <PaymentDashboard
              onExport={handleExport}
              isExporting={exportEntries.isPending}
              onNavigateTab={setActiveTab}
            />
          </TabsContent>
          <TabsContent value="receivables" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <EntriesTable type="RECEIVABLE" />
          </TabsContent>
          <TabsContent value="payables" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <EntriesTable type="PAYABLE" />
          </TabsContent>
          <TabsContent value="cashflow" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <CashflowTab />
          </TabsContent>
          <TabsContent value="projection" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <ProjectionTab />
          </TabsContent>
          <TabsContent value="dre" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <DreTab />
          </TabsContent>
          <TabsContent value="dro" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <DroTab />
          </TabsContent>
          <TabsContent value="accounts" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <AccountsTab />
          </TabsContent>
          <TabsContent value="contacts" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <ContactsTab />
          </TabsContent>
          <TabsContent value="contracts" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <ContractsTab />
          </TabsContent>
          <TabsContent value="documents" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
            <DocumentsTab />
          </TabsContent>
          {showApprovalsTab && (
            <TabsContent value="approvals" className="px-4 sm:px-6 py-5 sm:py-6 mt-0">
              <ApprovalsTab />
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto p-0"
        >
          <SheetHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b sticky top-0 bg-background z-20">
            <div className="flex items-center gap-2">
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 -ml-1"
                  aria-label="Voltar"
                  title="Voltar"
                >
                  <ArrowLeft className="size-4" />
                </Button>
              </SheetClose>
              <SheetTitle className="flex min-w-0 items-center gap-2">
                <Settings className="size-4 shrink-0" />
                <span className="truncate">Configurações do Payment</span>
              </SheetTitle>
            </div>
          </SheetHeader>
          <div className="px-4 sm:px-6 py-6 space-y-10">
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border/40">
                Governança e Aprovações
              </h3>
              <GovernanceSettingsTab />
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border/40">
                Régua de Cobrança
              </h3>
              <DunningRulesTab />
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border/40">
                Integrações
              </h3>
              <NerpFinancialToggle />
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border/40">
                Outras configurações
              </h3>
              <PaymentSettings />
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
