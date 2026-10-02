"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ListFilterIcon, MegaphoneIcon, ZapIcon } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { CHANNEL_LABEL, ChannelIcon } from "../utils/channel-display";
import type { ChannelFilter } from "../utils/channel-filter";
import { useUnansweredCounts } from "../hooks/use-unanswered-counts";
import { QuickWorkflowDialog } from "@/features/workflows/components/quick-builder/quick-workflow-dialog";

interface ChatOrbitDockProps {
  trackingId: string | null;
  selectedChannel: ChannelFilter;
  activeFiltersCount: number;
  onOpenFilters: () => void;
  onOpenChannels: () => void;
}

/** Dock do Chat no celular: Filtros e Canais à esquerda do ASTRO, Campanhas e Gatilhos à direita. */
export function ChatOrbitDock({
  trackingId,
  selectedChannel,
  activeFiltersCount,
  onOpenFilters,
  onOpenChannels,
}: ChatOrbitDockProps) {
  const { total: unansweredTotal } = useUnansweredCounts(trackingId);
  const [isTriggersDialogOpen, setIsTriggersDialogOpen] = useState(false);

  useRegisterOrbitDock({
    leftItems: [
      {
        label: activeFiltersCount > 0 ? `Filtros (${activeFiltersCount})` : "Filtros",
        icon: <ListFilterIcon />,
        isActive: activeFiltersCount > 0,
        onSelect: onOpenFilters,
      },
      {
        label: CHANNEL_LABEL[selectedChannel],
        icon: <ChannelIcon channel={selectedChannel} />,
        isActive: selectedChannel !== "ALL",
        badgeCount: unansweredTotal,
        onSelect: onOpenChannels,
      },
    ],
    rightItems: [
      { label: "Campanhas", href: "/campanhas", icon: <MegaphoneIcon /> },
      {
        label: "Gatilhos",
        icon: <ZapIcon />,
        // Mesmo popup do "Gatilhos" do topo do chat: novo gatilho para o tracking inteiro.
        onSelect: () =>
          trackingId ? setIsTriggersDialogOpen(true) : toast.info("Selecione um tracking primeiro"),
      },
    ],
  });

  if (!trackingId) return null;
  return (
    <QuickWorkflowDialog
      isOpen={isTriggersDialogOpen}
      onOpenChange={setIsTriggersDialogOpen}
      trackingId={trackingId}
    />
  );
}
