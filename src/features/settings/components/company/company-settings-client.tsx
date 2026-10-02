"use client";

import { useState } from "react";
import { Building2Icon, MapPinIcon, TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormCompany } from "../form-compnay";
import { BrandTab } from "../brand/brand-tab";
import { CompanyDetailsTab } from "./company-details-tab";
import { CalendarShareSection } from "./calendar-share-section";

interface Company {
  id: string;
  name: string;
  logo?: string;
  companyNiche: string;
  companyCep: string;
  brandIcp: string;
  brandSwot: Record<string, string>;
}

const TABS = [
  { id: "geral", label: "Dados", icon: Building2Icon },
  { id: "empresa", label: "Negócio", icon: MapPinIcon },
  { id: "marca", label: "Marca", icon: TagIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CompanySettingsClient({ company }: { company: Company }) {
  const [activeTab, setActiveTab] = useState<TabId>("geral");

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex w-full rounded-full bg-muted p-1 sm:w-max">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors sm:flex-none",
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "geral" && (
        <div className="space-y-6">
          <FormCompany company={company} />
          <CalendarShareSection />
        </div>
      )}
      {activeTab === "empresa" && (
        <CompanyDetailsTab
          orgId={company.id}
          companyNiche={company.companyNiche}
          companyCep={company.companyCep}
          brandIcp={company.brandIcp}
          brandSwot={company.brandSwot}
        />
      )}
      {activeTab === "marca" && <BrandTab entity="org" />}
    </div>
  );
}
