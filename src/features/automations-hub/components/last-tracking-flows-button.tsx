"use client";

import Link from "next/link";
import { useAtomValue } from "jotai";
import { WorkflowIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import { useAutomationsOverview } from "@/features/automations-hub/hooks/use-automations-hub";
import { lastTrackingIdAtom } from "@/features/trackings/lib/last-tracking";

// Atalho da central para os fluxos do funil: abre sempre o último funil que a pessoa visitou. Se ele
// não for da empresa ativa (ou ela ainda não abriu nenhum), vale o primeiro funil que ela alcança.

export function LastTrackingFlowsButton() {
  const { data: overview } = useAutomationsOverview();
  const lastTrackingId = useAtomValue(lastTrackingIdAtom);
  const trackings = overview?.trackings ?? [];
  const tracking = trackings.find((candidate) => candidate.id === lastTrackingId) ?? trackings[0];
  if (!tracking) return null;

  return (
    <Button asChild variant="outline" size="sm" data-guide={GUIDE_ANCHORS.gatilhosOpenTrackingFlows.id}>
      <Link href={`/tracking/${tracking.id}/workflows`} title={`Abrir os fluxos e o mapa do funil ${tracking.name}`}>
        <WorkflowIcon className="size-4" />
        <span className="max-w-40 truncate">Fluxos de {tracking.name}</span>
      </Link>
    </Button>
  );
}
