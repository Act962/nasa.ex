"use client";

import { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { ToastProvider } from "@/contexts/toast-context";
import { AdminToastContainer } from "./admin-toast-container";

interface AdminLayoutClientProps {
  adminUser: any;
  children: ReactNode;
}

export function AdminLayoutClient({ adminUser, children }: AdminLayoutClientProps) {
  return (
    <ToastProvider>
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
    </ToastProvider>
  );
}
