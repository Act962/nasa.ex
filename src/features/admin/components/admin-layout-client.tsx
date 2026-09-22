"use client";

import { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { ToastProvider } from "@/contexts/toast-context";
import { AdminToastContainer } from "./admin-toast-container";
import { AlertProvider } from "@/features/alerts/components/alert-provider";

interface AdminLayoutClientProps {
  adminUser: any;
  children: ReactNode;
}

export function AdminLayoutClient({ adminUser, children }: AdminLayoutClientProps) {
  // O AlertProvider vivia só em (platform)/(tracking) — um admin no painel não
  // recebia popup nenhum. Aqui ele cobre o /admin (spec 0021, D-6).
  return (
    <ToastProvider>
      <AlertProvider>
        <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
          <AdminSidebar />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <AdminHeader adminUser={adminUser} />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
        <AdminToastContainer />
      </AlertProvider>
    </ToastProvider>
  );
}
