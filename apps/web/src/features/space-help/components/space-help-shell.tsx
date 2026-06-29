"use client";

import { type ReactNode } from "react";
import { SpaceHelpSidebarNav } from "./space-help-sidebar-nav";

export function SpaceHelpShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)] bg-background">
      <SpaceHelpSidebarNav />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
