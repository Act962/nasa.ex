"use client";

import { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminHeader } from "./admin-header";
import { ToastProvider } from "@/contexts/toast-context";
import { AdminToastContainer } from "./admin-toast-container";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface AdminLayoutClientProps {
  adminUser: any;
  children: ReactNode;
}

export function AdminLayoutClient({ adminUser, children }: AdminLayoutClientProps) {
  return (
    <ToastProvider>
      <SidebarProvider defaultOpen className="bg-zinc-950 text-white">
        <AdminSidebar />
        <SidebarInset className="flex h-svh flex-col overflow-hidden bg-zinc-950 text-white min-w-0">
          <AdminHeader adminUser={adminUser} />
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <AdminToastContainer />
    </ToastProvider>
  );
}
