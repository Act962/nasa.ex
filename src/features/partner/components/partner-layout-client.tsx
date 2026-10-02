"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { PartnerSidebar } from "./partner-sidebar";
import { ToastProvider } from "@/contexts/toast-context";

interface PartnerLayoutClientProps {
  partnerUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  tier: string | null;
  children: ReactNode;
}

const TIER_BADGE_CLASS: Record<string, string> = {
  SUITE: "bg-muted text-foreground",
  EARTH: "bg-temp-cold/15 text-temp-cold",
  GALAXY: "bg-temp-warm/15 text-temp-warm",
  CONSTELLATION: "bg-temp-hot/15 text-temp-hot",
  INFINITY: "bg-temp-very-hot/15 text-temp-very-hot",
};

export function PartnerLayoutClient({
  partnerUser,
  tier,
  children,
}: PartnerLayoutClientProps) {
  return (
    <ToastProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <PartnerSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="h-14 bg-card px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Olá,</span>
              <span className="text-foreground font-semibold">
                {partnerUser.name}
              </span>
              {tier && (
                <span
                  className={cn(
                    "ml-2 text-xs font-semibold px-2 py-0.5 rounded-full",
                    TIER_BADGE_CLASS[tier] ?? "bg-muted text-foreground",
                  )}
                >
                  {tier}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{partnerUser.email}</div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
