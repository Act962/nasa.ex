"use client";

/**
 * Helper centralizado pra mostrar erros do envio de mensagem com UI
 * apropriada. Substitui o `toast.error("Erro ao enviar mensagem")` genérico
 * dos 5 hooks de mutation no `use-messages.ts`.
 *
 * Tipos de erro tratados:
 *  - WHATSAPP_DISCONNECTED → toast persistente com botão "Reconectar agora"
 *    que leva pra aba Integrações do tracking
 *  - Demais erros → toast.error genérico
 */
import { toast } from "sonner";

interface OrpcError {
  message?: string;
  code?: string;
  data?: {
    code?: string;
    detail?: string;
    originalMessage?: string;
  };
}

/**
 * Detecta se o erro vem da uazapi com sessão WhatsApp caída.
 * Verifica em 3 lugares por robustez (oRPC serializa de formas diferentes
 * dependendo da versão do client + transporte).
 */
function isWhatsappDisconnected(err: unknown): boolean {
  const e = err as OrpcError;
  if (e?.data?.code === "WHATSAPP_DISCONNECTED") return true;
  const msg = String(e?.message ?? "");
  return (
    msg === "WHATSAPP_DISCONNECTED" ||
    msg.includes("WHATSAPP_DISCONNECTED") ||
    msg.toLowerCase().includes("whatsapp disconnected") ||
    msg.includes("session is not reconnectable")
  );
}

/** Lê `trackingId` da URL atual — usado quando o caller não passa explicitamente. */
function getTrackingIdFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  // 1. Query string `?trackingId=xxx` (tracking-chat usa esse padrão)
  const url = new URL(window.location.href);
  const qp = url.searchParams.get("trackingId");
  if (qp) return qp;
  // 2. Path `/tracking/<id>/...` (settings, workflows, etc)
  const pathMatch = url.pathname.match(/\/tracking\/([^/]+)/);
  return pathMatch?.[1];
}

export function showSendMessageError(
  err: unknown,
  ctx: { trackingId?: string } = {},
) {
  if (isWhatsappDisconnected(err)) {
    const trackingId = ctx.trackingId ?? getTrackingIdFromUrl();
    toast.error("WhatsApp desconectado", {
      description:
        "A sessão caiu. Reconecte a instância pra continuar enviando mensagens.",
      duration: 12_000,
      action: trackingId
        ? {
            label: "Reconectar agora",
            onClick: () => {
              // Aba "Integrações" do settings do tracking — fica `?tab=instance`
              window.location.href = `/tracking/${trackingId}/settings?tab=instance`;
            },
          }
        : undefined,
    });
    return;
  }

  // Fallback genérico
  toast.error("Erro ao enviar mensagem");
}
