"use client";

import { useEffect } from "react";
import type { AstroVoice } from "@/features/astro/lib/astro-voice-catalog";
import { useAstroFeedStore, type AstroFeedItem } from "@/features/astro/voice/use-astro-feed-store";
import { useAstroWidgetStore } from "@/features/astro/voice/use-astro-widget-store";

/**
 * Balões ao chegar numa página, como o ASTRO do site orbitatec.com.br
 * (`@nerp/astro-widget`): espera a página assentar, fala em sequência e o
 * último balão fica um tempo antes de sumir (spec 0029, RF-10).
 *
 * Sem isso o balão só aparecia quando um alerta chegava ao vivo — quem abre a
 * página com três avisos pendentes não via nada.
 */

/** Tempo de a página assentar e ser lida antes do primeiro balão. */
const FIRST_BALLOON_DELAY_MS = 2_200;
/** Intervalo entre um balão e o seguinte. */
const BETWEEN_BALLOONS_MS = 3_400;
/** Quanto o último balão fica na tela. */
const LAST_BALLOON_MS = 7_000;
/** Avisos pendentes falados por página — o resto está na aba Início. */
const MAX_ALERT_BALLOONS = 2;

interface PendingAlert {
  id: string;
  isRead: boolean;
  astro: AstroVoice;
}

function tipFor(pathname: string): Omit<AstroFeedItem, "createdAt" | "id"> {
  if (pathname.startsWith("/tracking-chat")) {
    return {
      kind: "alert",
      headline: "Quer ajuda com as conversas?",
      detail: "Eu leio o histórico e sugiro a resposta para cada lead.",
      priority: "info",
      openView: "home",
    };
  }
  if (pathname.startsWith("/payment")) {
    return {
      kind: "alert",
      headline: "Posso cuidar do financeiro",
      detail: "Te digo o que vence hoje e concilio o extrato para você.",
      priority: "info",
      openView: "home",
    };
  }
  if (pathname.startsWith("/tracking") || pathname.startsWith("/contatos")) {
    return {
      kind: "alert",
      headline: "Quais leads priorizar hoje?",
      detail: "Eu olho o funil e te digo onde estão as oportunidades.",
      priority: "info",
      openView: "home",
    };
  }
  if (pathname.startsWith("/agendas") || pathname.startsWith("/workspaces")) {
    return {
      kind: "alert",
      headline: "Organizo seu dia",
      detail: "Te mostro as tarefas e compromissos que vencem hoje.",
      priority: "info",
      openView: "home",
    };
  }
  return {
    kind: "alert",
    headline: "Oi, aqui é o Astro",
    detail: "Me dá uma ordem e eu executo — agora ou todo dia.",
    priority: "info",
    openView: "home",
  };
}

export function useAstroBalloonTour(params: {
  pathname: string;
  /** Só roda depois que avisos e aprovações carregaram. */
  isReady: boolean;
  alerts: PendingAlert[];
  pendingApprovals: number;
}) {
  const { pathname, isReady, alerts, pendingApprovals } = params;
  useEffect(() => {
    // Uma sequência por página: o efeito só roda de novo quando a página muda.
    if (!isReady) return;
    // Página nova: o "×" do balão valia só para a anterior.
    useAstroFeedStore.getState().setHidden(false);

    const balloons: Array<Omit<AstroFeedItem, "createdAt">> = [];

    if (pendingApprovals > 0) {
      balloons.push({
        id: "tour-approvals",
        kind: "alert",
        headline:
          pendingApprovals === 1
            ? "1 ação esperando sua aprovação"
            : `${pendingApprovals} ações esperando sua aprovação`,
        detail: "Preparei tudo, só falta o seu ok.",
        priority: "urgent",
        openView: "home",
      });
    }

    // Um balão por fala: avisos repetidos (mesmo título e texto) contam uma vez.
    const seenSpeeches = new Set<string>();
    for (const alert of alerts) {
      if (alert.isRead) continue;
      const speechKey = `${alert.astro.headline}|${alert.astro.speech}`;
      if (seenSpeeches.has(speechKey)) continue;
      seenSpeeches.add(speechKey);
      balloons.push({
        id: `tour-${alert.id}`,
        kind: "alert",
        headline: alert.astro.headline,
        detail: alert.astro.speech,
        priority: alert.astro.priority,
        openView: "home",
      });
      if (seenSpeeches.size >= MAX_ALERT_BALLOONS) break;
    }

    if (balloons.length === 0) balloons.push({ id: "tour-tip", ...tipFor(pathname) });

    const timers: number[] = [];
    balloons.forEach((balloon, index) => {
      const isLast = index === balloons.length - 1;
      timers.push(
        window.setTimeout(() => {
          // Painel aberto: a conversa já está acontecendo, o balão não tem função.
          if (useAstroWidgetStore.getState().isOpen) return;
          useAstroFeedStore
            .getState()
            .push(balloon, isLast ? LAST_BALLOON_MS : BETWEEN_BALLOONS_MS);
        }, FIRST_BALLOON_DELAY_MS + index * BETWEEN_BALLOONS_MS),
      );
    });

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
    // `alerts` muda a cada refetch do sino; a sequência é por página, não por refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, pathname]);
}
