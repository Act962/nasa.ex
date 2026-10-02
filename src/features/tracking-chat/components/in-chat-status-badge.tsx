"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { RadioIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useInChatStatusRealtime } from "../hooks/use-in-chat-status-realtime";

/**
 * Badge "In-Chat ON/AUTO/BOTH" no header do /tracking-chat (Sprint 3.5).
 *
 * Polling 30s via getInChatStatus. Aparece quando In-Chat está ativo
 * (auto OU manual). Click → leva pro settings do tracking pra owner
 * desligar/ligar manualmente.
 *
 * Cores por source:
 *  - manual    → violeta (ativação intencional do owner)
 *  - auto      → amarelo (fallback emergencial — instância banida)
 *  - both      → vermelho (ambos: instância banida E manual ON)
 *  - off       → null (não renderiza nada)
 */
export function InChatStatusBadge({ trackingId }: { trackingId: string }) {
  // Push-based: subscribe no channel pusher do trackingId pra invalidar
  // a query quando o status muda. Zero polling.
  useInChatStatusRealtime(trackingId);

  const { data } = useQuery({
    ...orpc.conversation.getInChatStatus.queryOptions({
      input: { trackingId },
    }),
    // Sem polling — Pusher cuida das invalidações em tempo real.
    // Safety net: refetchInterval longo (15min) caso o Pusher falhe
    // silenciosamente. staleTime 5min deduplica queries cross-componente.
    refetchInterval: 15 * 60_000,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (!data?.active) return null;

  const config = {
    manual: {
      label: "In-Chat ON",
      colors:
        "bg-info/15 text-info border-info/30 hover:bg-info/20 dark:bg-info/15 dark:text-info dark:border-info/40",
      title: "In-Chat manual ativado pelo time. Clique pra gerenciar.",
    },
    auto: {
      label: "In-Chat AUTO",
      colors:
        "bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 dark:bg-warning/15 dark:text-warning dark:border-warning/40",
      title: "WhatsApp fora do ar. In-Chat assumiu automaticamente.",
    },
    both: {
      label: "In-Chat BOTH",
      colors:
        "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20 dark:bg-destructive/15 dark:text-destructive dark:border-destructive/40",
      title:
        "WhatsApp banido E In-Chat manual ativo. Clique pra gerenciar.",
    },
  }[data.source as "manual" | "auto" | "both"];

  if (!config) return null;

  return (
    <Link
      href={`/tracking/${trackingId}/settings`}
      title={config.title}
      className="shrink-0"
    >
      <Badge
        variant="outline"
        className={cn(
          "gap-1 cursor-pointer transition-colors text-[10px] h-5 px-2",
          config.colors,
        )}
      >
        <RadioIcon className="size-2.5" />
        {config.label}
      </Badge>
    </Link>
  );
}
