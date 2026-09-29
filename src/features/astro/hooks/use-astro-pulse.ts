"use client";

import { useEffect } from "react";
import {
  ASTRO_ACTIVITY_EVENT,
  ASTRO_ALERT_EVENT,
  type AstroActivityDetail,
  type AstroAlertDetail,
} from "@/features/astro/lib/astro-alert-event";
import {
  buildAstroVoice,
  shouldSpeakAlert,
} from "@/features/astro/lib/astro-voice-catalog";
import { useAstroFeedStore } from "@/features/astro/voice/use-astro-feed-store";
import { useVoiceModeStore } from "@/features/astro/voice/use-voice-mode-store";
import { speak } from "@/features/astro/voice/tts";

/**
 * Faz o ASTRO "falar" no balão do orb (spec 0029, RF-10 / RF-11).
 *
 * Alertas: primeiro "Enviando notificação…", depois o título e a fala. Voz alta
 * só com o modo "Sempre falar" ligado e prioridade alta — o modo "match" narra
 * só o que o usuário pediu por voz, e alerta não é pedido.
 *
 * Atividades: o que o ASTRO está fazendo agora (comando executando, concluído).
 */

const ANNOUNCE_MS = 1_200;
const ALERT_TTL_MS = { urgent: 20_000, important: 12_000, info: 8_000 } as const;
const ACTIVITY_DONE_TTL_MS = 6_000;

export function useAstroPulse() {
  useEffect(() => {
    let alertSequence = 0;

    const handleAlert = (event: Event) => {
      const detail = (event as CustomEvent<AstroAlertDetail>).detail;
      if (!detail) return;

      const voice =
        detail.astro ??
        buildAstroVoice({
          kind: detail.eventType,
          title: detail.title,
          body: detail.body,
          actionUrl: detail.actionUrl,
          severity: detail.severity,
        });

      const feed = useAstroFeedStore.getState();
      alertSequence += 1;
      const announceId = `announce-${alertSequence}`;
      feed.push(
        {
          id: announceId,
          kind: "activity",
          headline: "Astro está enviando uma notificação…",
          priority: "info",
        },
        ANNOUNCE_MS,
      );

      window.setTimeout(() => {
        const alertId = detail.notificationId ?? `alert-${Date.now()}-${alertSequence}`;
        useAstroFeedStore.getState().remove(announceId);
        useAstroFeedStore.getState().push(
          {
            id: alertId,
            kind: "alert",
            headline: voice.headline,
            detail: voice.speech,
            priority: voice.priority,
          },
          ALERT_TTL_MS[voice.priority],
        );

        const { outputMode } = useVoiceModeStore.getState();
        if (shouldSpeakAlert(outputMode, voice.priority)) {
          // Sem gesto do usuário o navegador pode bloquear o áudio; o balão já
          // apareceu, então falha silenciosa é aceitável (CB-9).
          try {
            speak(voice.speech);
          } catch {
            /* áudio bloqueado */
          }
        }
      }, ANNOUNCE_MS);
    };

    const handleActivity = (event: Event) => {
      const detail = (event as CustomEvent<AstroActivityDetail>).detail;
      if (!detail) return;
      useAstroFeedStore.getState().push(
        {
          id: `activity-${detail.id}`,
          kind: detail.state === "running" ? "activity" : "alert",
          headline: detail.headline,
          detail: detail.detail,
          priority: detail.state === "failed" ? "important" : "info",
        },
        detail.state === "running" ? undefined : ACTIVITY_DONE_TTL_MS,
      );
    };

    window.addEventListener(ASTRO_ALERT_EVENT, handleAlert);
    window.addEventListener(ASTRO_ACTIVITY_EVENT, handleActivity);
    return () => {
      window.removeEventListener(ASTRO_ALERT_EVENT, handleAlert);
      window.removeEventListener(ASTRO_ACTIVITY_EVENT, handleActivity);
    };
  }, []);
}
