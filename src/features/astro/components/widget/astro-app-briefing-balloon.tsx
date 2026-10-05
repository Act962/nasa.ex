"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePaymentTabStore } from "@/features/payment/store/use-payment-tab-store";
import { resolveWidgetScreenContext } from "@/features/astro/lib/widget-screen-context";
import { useAstroAppBriefing } from "@/features/astro/hooks/use-astro-app-briefing";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";
import { useAstroFeedStore } from "@/features/astro/voice/use-astro-feed-store";

/** Painel do Astro fechado: o resumo do App aberto aparece no balão de fala do orb (spec 0056, RF-9). */

const BRIEFING_BALLOON_ID = "app-briefing";
const BRIEFING_BALLOON_TTL_MS = 10_000;

// Fora do componente: o balão de um App sai uma vez por visita, sem repetir a cada render ou remontagem do provider.
let lastAnnouncedContextKey: string | null = null;

export function AstroAppBriefingBalloon() {
  const pathname = usePathname();
  const paymentTab = usePaymentTabStore((state) => state.activeTab);
  const isWidgetOpen = useAstroWidgetStore((state) => state.isOpen);
  const { briefingApp, screenLabel } = resolveWidgetScreenContext(pathname, paymentTab);
  const briefing = useAstroAppBriefing(briefingApp, { enabled: !isWidgetOpen });
  const briefingMessage = briefing.data?.message ?? null;

  useEffect(() => {
    if (isWidgetOpen) {
      // Com o painel aberto quem fala é a conversa; o balão não repete a mesma coisa depois.
      lastAnnouncedContextKey = screenLabel;
      return;
    }
    if (!briefingMessage || lastAnnouncedContextKey === screenLabel) return;
    lastAnnouncedContextKey = screenLabel;
    useAstroFeedStore.getState().push(
      {
        id: BRIEFING_BALLOON_ID,
        kind: "alert",
        headline: briefingMessage,
        priority: "info",
        openView: "chat",
      },
      BRIEFING_BALLOON_TTL_MS,
    );
  }, [briefingMessage, isWidgetOpen, screenLabel]);

  return null;
}
