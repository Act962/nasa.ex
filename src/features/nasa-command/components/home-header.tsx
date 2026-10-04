"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { StarsWidget } from "@/features/stars";
import { FullscreenControls } from "@/components/fullscreen-controls/fullscreen-controls";

/** Topo da Início: menu lateral à esquerda e Stars à direita, sem título (o ASTRO ocupa o centro). */
export function HomeHeader() {
  return (
    <header className="relative z-20 flex shrink-0 items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-2">
      <SidebarTrigger className="size-10" />
      <div className="flex items-center gap-2">
        <div data-tour="stars">
          <StarsWidget variant="icon" />
        </div>
        <FullscreenControls />
      </div>
    </header>
  );
}
