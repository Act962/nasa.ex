"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ListFilterIcon, MegaphoneIcon, ReceiptIcon } from "lucide-react";
import { useRegisterOrbitDock } from "@/components/orbit-dock/orbit-dock-store";
import { CHANNEL_LABEL, ChannelIcon } from "../utils/channel-display";
import type { ChannelFilter } from "../utils/channel-filter";
import { useUnansweredCounts } from "../hooks/use-unanswered-counts";
import { ReceiptPanel } from "./receipt-panel/receipt-panel";

interface ChatOrbitDockProps {
  trackingId: string | null;
  selectedChannel: ChannelFilter;
  activeFiltersCount: number;
  onOpenFilters: () => void;
  onOpenChannels: () => void;
}

/**
 * Dock do Chat no celular: Filtros e Canais à esquerda do ASTRO, Campanhas e Recibo à direita.
 * Gatilhos saiu daqui porque já tem botão no topo do chat (spec 0151).
 */
export function ChatOrbitDock({
  trackingId,
  selectedChannel,
  activeFiltersCount,
  onOpenFilters,
  onOpenChannels,
}: ChatOrbitDockProps) {
  const { total: unansweredTotal } = useUnansweredCounts(trackingId);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

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
        label: "Recibo",
        icon: <ReceiptIcon />,
        // Recibo avulso: o cliente novo entra no tracking aberto no chat.
        onSelect: () => (trackingId ? setIsReceiptOpen(true) : toast.info("Selecione um tracking primeiro")),
      },
    ],
  });

  if (!trackingId) return null;
  return <ReceiptPanel open={isReceiptOpen} onOpenChange={setIsReceiptOpen} mode={{ kind: "standalone", trackingId }} />;
}
