import type { AstroVoice } from "./astro-voice-catalog";

/**
 * Eventos do ASTRO que chegam pelo Pusher e são repassados para a janela
 * (spec 0029, RF-10). O `alert-provider` já assina os canais; orb e widget só
 * escutam estes eventos, sem abrir uma segunda assinatura.
 */
export const ASTRO_ALERT_EVENT = "astro:alert";
export const ASTRO_ACTIVITY_EVENT = "astro:activity";

/** Nome do evento Pusher de atividade, no canal `private-user-{id}`. */
export const ASTRO_ACTIVITY_PUSHER_EVENT = "astro:activity";

export interface AstroAlertDetail {
  title: string;
  body: string;
  actionUrl?: string | null;
  eventType?: string;
  severity?: string;
  notificationId?: string;
  astro?: AstroVoice;
}

/** O que o ASTRO está fazendo agora (ex.: um comando executando). */
export interface AstroActivityDetail {
  /** Mesmo id do começo ao fim: o fim substitui o "executando". */
  id: string;
  state: "running" | "done" | "waiting" | "failed";
  headline: string;
  detail?: string;
}
