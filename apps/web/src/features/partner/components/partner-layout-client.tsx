"use client";

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

export function PartnerLayoutClient({
  partnerUser,
  tier,
  children,
}: PartnerLayoutClientProps) {
  return (
    <ToastProvider>
      <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
        <PartnerSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="h-14 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Olá,</span>
              <span className="text-white font-semibold">
                {partnerUser.name}
              </span>
              {tier && (
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                  {tier}
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500">{partnerUser.email}</div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
