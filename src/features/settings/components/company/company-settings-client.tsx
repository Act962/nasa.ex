"use client";

import { useState } from "react";
import { Building2Icon, TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormCompany } from "../form-compnay";
import { BrandTab } from "../brand/brand-tab";

interface Company {
  id: string;
  name: string;
  logo?: string;
}

const TABS = [
  { id: "geral", label: "Geral",  icon: Building2Icon },
  { id: "marca", label: "Marca",  icon: TagIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CompanySettingsClient({ company }: { company: Company }) {
  const [activeTab, setActiveTab] = useState<TabId>("geral");

  return (
    <div className="space-y-4">
      {/* Inner tab nav */}
      <div className="flex items-center gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "geral" && <FormCompany company={company} />}
      {activeTab === "marca" && <BrandTab entity="org" />}
    </div>
  );
}
