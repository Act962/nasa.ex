"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building2,
  Calculator,
  CalendarClock,
  FileStack,
  FolderLock,
  Gauge,
  Landmark,
  ListTree,
  Receipt,
  Scale,
  Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePaymentTabStore } from "@/features/payment/store/use-payment-tab-store";
import { SpaceHelpButton } from "@/features/space-help/components/space-help-button";
import { AccountingOverview } from "./overview/accounting-overview";
import { CompanyDocumentsSection } from "./documents/company-documents-section";
import { TaxProfileSection } from "./profile/tax-profile-section";
import { AssessmentsSection } from "./assessments/assessments-section";
import { CreditsSection } from "./credits/credits-section";
import { PricingSection } from "./pricing/pricing-section";
import { FiscalCalendarSection } from "./calendar/fiscal-calendar-section";
import { CalculatorSection } from "./calculator/calculator-section";
import { ChartOfAccountsSection } from "./chart/chart-of-accounts-section";
import { LedgerReportsSection } from "./reports/ledger-reports-section";
import { ReformSection } from "./reform/reform-section";
import { CalculatorFab } from "./calculator/calculator-fab";

export type AccountingSectionId =
  | "overview"
  | "documents"
  | "profile"
  | "assessments"
  | "credits"
  | "pricing"
  | "calendar"
  | "calculator"
  | "chart"
  | "reports"
  | "reform";

interface AccountingSection {
  id: AccountingSectionId;
  label: string;
  icon: LucideIcon;
  render: (onNavigate: (section: string) => void) => React.ReactNode;
}

const SECTIONS: AccountingSection[] = [
  { id: "overview", label: "Visão geral", icon: Gauge, render: (onNavigate) => <AccountingOverview onNavigate={onNavigate} /> },
  { id: "documents", label: "N-Box · Documentos", icon: FolderLock, render: (onNavigate) => <CompanyDocumentsSection onNavigate={onNavigate} /> },
  { id: "profile", label: "Perfil fiscal", icon: Building2, render: (onNavigate) => <TaxProfileSection onNavigate={onNavigate} /> },
  { id: "assessments", label: "Apurações e guias", icon: Receipt, render: (onNavigate) => <AssessmentsSection onNavigate={onNavigate} /> },
  { id: "credits", label: "Créditos", icon: FileStack, render: (onNavigate) => <CreditsSection onNavigate={onNavigate} /> },
  { id: "pricing", label: "Produtos & Preços", icon: Tags, render: (onNavigate) => <PricingSection onNavigate={onNavigate} /> },
  { id: "calendar", label: "Calendário fiscal", icon: CalendarClock, render: (onNavigate) => <FiscalCalendarSection onNavigate={onNavigate} /> },
  { id: "calculator", label: "Calculadora", icon: Calculator, render: (onNavigate) => <CalculatorSection onNavigate={onNavigate} /> },
  { id: "chart", label: "Plano de contas", icon: ListTree, render: (onNavigate) => <ChartOfAccountsSection onNavigate={onNavigate} /> },
  { id: "reports", label: "Balancete e balanço", icon: Scale, render: (onNavigate) => <LedgerReportsSection onNavigate={onNavigate} /> },
  { id: "reform", label: "Reforma Tributária", icon: BookOpen, render: (onNavigate) => <ReformSection onNavigate={onNavigate} /> },
];

/** Artigo do Space Help que o botão "Como usar" abre em cada subaba. */
const SECTION_HELP_ARTICLE: Partial<Record<AccountingSectionId, string>> = {
  assessments: "contabil-apurar-e-gerar-guia",
  calendar: "contabil-apurar-e-gerar-guia",
  documents: "contabil-documentos-e-score",
  credits: "contabil-creditos-ibs-cbs",
  pricing: "contabil-precificacao",
  calculator: "contabil-calculadora",
  reform: "contabil-reforma-tributaria",
};

const SECTION_IDS = new Set<string>(SECTIONS.map((section) => section.id));

/** Aba "Contábil" do Payment (spec 0051). A subaba vai para a URL (`?sub=`). */
export function AccountingTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("sub") ?? "overview";
  const activeSection = (SECTION_IDS.has(requestedSection) ? requestedSection : "overview") as AccountingSectionId;

  const navigateTo = useCallback(
    (section: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "accounting");
      if (section === "overview") params.delete("sub");
      else params.set("sub", section);
      router.replace(`/payment?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // A subaba vai para o store que o contexto do ASTRO lê: "o que está vencido?"
  // no Calendário é sobre guias, em Documentos é sobre certidões.
  const publishSubTab = usePaymentTabStore((state) => state.setActiveSubTab);
  useEffect(() => {
    publishSubTab(activeSection);
    return () => publishSubTab(null);
  }, [activeSection, publishSubTab]);

  const current = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-info shadow-sm">
            <Landmark className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">Contábil</h2>
            <p className="text-xs text-muted-foreground">
              Impostos, guias, documentos e contabilidade — com explicação em cada termo.
            </p>
          </div>
        </div>
        <SpaceHelpButton
          categorySlug="payment"
          featureSlug={SECTION_HELP_ARTICLE[activeSection] ?? "contabil-primeiros-passos"}
          label="Como usar"
          variant="outline"
        />
      </div>

      <nav
        aria-label="Seções da aba Contábil"
        className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => navigateTo(section.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-info/40 bg-info/10 text-info dark:text-info"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              {section.label}
            </button>
          );
        })}
      </nav>

      <section aria-label={current.label}>{current.render(navigateTo)}</section>

      {activeSection !== "calculator" && <CalculatorFab contextSection={activeSection} />}
    </div>
  );
}
