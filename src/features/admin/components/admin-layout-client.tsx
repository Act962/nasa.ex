"use client";

import { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { AdminAiCreditsBanner } from "@/features/ai-credits/components/admin-ai-credits-banner";
import { ToastProvider } from "@/contexts/toast-context";
import { AdminToastContainer } from "./admin-toast-container";

interface AdminLayoutClientProps {
  adminUser: any;
  children: ReactNode;
}

export function AdminLayoutClient({ adminUser, children }: AdminLayoutClientProps) {
  // O AlertProvider não mora mais aqui: subiu para o layout raiz, para o popup
  // seguir o admin por toda a aplicação (spec 0021, D-6).
  return (
    <ToastProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* No celular o menu abre pelo botão do cabeçalho. */}
        <AdminSidebar className="hidden md:flex" />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <AdminHeader adminUser={adminUser} />
          <AdminAiCreditsBanner />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
      <AdminToastContainer />
    </ToastProvider>
  );
}
