"use client";

import { ZapIcon } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { ICON_MODE_BUTTON, ICON_MODE_LABEL } from "@/components/sidebar/icon-mode";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useAutomationsHubStore } from "../store";

/** Botão da barra lateral que abre a central de Gatilhos Automáticos de qualquer App. */
export function AutomationsHubButton() {
  const open = useAutomationsHubStore((state) => state.open);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="Gatilhos Automáticos"
        className={ICON_MODE_BUTTON}
        onClick={() => open("active")}
        data-guide={GUIDE_ANCHORS.automationsHubButton.id}
      >
        <ZapIcon />
        <span className={ICON_MODE_LABEL}>Gatilhos Automáticos</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
