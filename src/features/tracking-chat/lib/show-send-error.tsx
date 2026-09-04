"use client";

/**
 * Helper centralizado pra mostrar erros do envio de mensagem com UI
 * apropriada. Substitui o `toast.error("Erro ao enviar mensagem")` genérico
 * dos 5 hooks de mutation no `use-messages.ts`.
 *
 * Tipos de erro tratados:
 *  - WHATSAPP_DISCONNECTED → toast persistente com botão "Reconectar agora"
 *    que leva pra aba Integrações do tracking
 *  - INSTANCE_NOT_FOUND / META_CREDENTIALS_INCOMPLETE → mesma CTA de
 *    configuração, texto próprio pra cada caso
 *  - META_WINDOW_CLOSED → explica a janela de 24h e aponta pro template
 *  - META_FEATURE_UNSUPPORTED / PROVIDER_FEATURE_UNSUPPORTED → mensagem do
 *    servidor, que já vem específica por feature
 *  - PROVIDER_SEND_INVALID_RESPONSE → falha transitória, sugere repetir
 *  - Demais erros → toast.error genérico
 *
 * Os `code` chegam via `data.code` desde a spec 0010 — antes, erro de
 * configuração e timeout de rede caíam os dois no toast genérico.
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

/** Duração de toast que o atendente precisa ler antes de agir. */
const ACTIONABLE_TOAST_MS = 12_000;

/**
 * Lê o `code` estruturado do erro oRPC. `data.code` é onde o servidor
 * grava; `code` no topo é o status oRPC (`BAD_REQUEST`), que não serve
 * pra ramificar.
 */
function getOutboundCode(err: unknown): string | undefined {
  return (err as OrpcError)?.data?.code;
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

/** CTA que leva pra aba de instância do tracking, quando dá pra descobrir qual é. */
function settingsAction(trackingId: string | undefined) {
  if (!trackingId) return undefined;
  return {
    label: "Abrir configurações",
    onClick: () => {
      window.location.href = `/tracking/${trackingId}/settings?tab=instance`;
    },
  };
}

export function showSendMessageError(
  err: unknown,
  ctx: { trackingId?: string } = {},
) {
  const trackingId = ctx.trackingId ?? getTrackingIdFromUrl();

  if (isWhatsappDisconnected(err)) {
    toast.error("WhatsApp desconectado", {
      description:
        "A sessão caiu. Reconecte a instância pra continuar enviando mensagens.",
      duration: ACTIONABLE_TOAST_MS,
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

  const serverMessage = (err as OrpcError)?.message;

  switch (getOutboundCode(err)) {
    case "INSTANCE_NOT_FOUND":
      toast.error("Nenhuma instância de WhatsApp configurada", {
        description:
          "Este tracking ainda não tem um número ligado. Configure a instância pra começar a enviar.",
        duration: ACTIONABLE_TOAST_MS,
        action: settingsAction(trackingId),
      });
      return;

    case "META_CREDENTIALS_INCOMPLETE":
      toast.error("Credenciais da API Oficial incompletas", {
        description:
          serverMessage ??
          "Reconecte o número em Configurações → WhatsApp → Provider.",
        duration: ACTIONABLE_TOAST_MS,
        action: settingsAction(trackingId),
      });
      return;

    case "META_WINDOW_CLOSED":
      toast.error("Janela de 24h fechada", {
        description:
          "O lead não responde há mais de 24h. Envie um template aprovado pra reabrir a conversa.",
        duration: ACTIONABLE_TOAST_MS,
      });
      return;

    // As duas mensagens do servidor já são específicas por feature
    // ("Editar mensagem não é suportado na Meta Cloud API…"), então
    // repeti-las aqui só criaria duas fontes de verdade.
    case "META_FEATURE_UNSUPPORTED":
    case "PROVIDER_FEATURE_UNSUPPORTED":
      toast.error("Operação indisponível neste provedor", {
        description: serverMessage,
        duration: ACTIONABLE_TOAST_MS,
      });
      return;

    case "PROVIDER_SEND_INVALID_RESPONSE":
      toast.error("O provedor não confirmou o envio", {
        description:
          "A mensagem não foi entregue. Tente novamente em alguns segundos.",
        duration: ACTIONABLE_TOAST_MS,
      });
      return;
  }

  // Fallback genérico
  toast.error("Erro ao enviar mensagem");
}
