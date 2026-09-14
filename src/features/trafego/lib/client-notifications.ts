/**
 * O que o cliente recebe (WhatsApp + e-mail) a cada fase do pedido.
 *
 * Status sem entrada aqui são silenciosos: PAID tem o e-mail de ativação
 * próprio, e MATERIALS_SUBMITTED / REQUESTED são ações do próprio cliente.
 */

import type { TrafegoOrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_LABEL } from "./order-status";

export interface ClientNotificationContext {
  clientName: string;
  orderCode: string;
  panelUrl: string;
  supportWhatsapp: string | null;
  partnerBusinessId: string | null;
  /** Recado que a equipe escreveu ao mudar o status (aparece na timeline). */
  clientNote: string | null;
}

export interface ClientStatusCopy {
  emailSubject: (ctx: ClientNotificationContext) => string;
  title: string;
  /** Parágrafo principal — vai no e-mail e no WhatsApp. */
  body: (ctx: ClientNotificationContext) => string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "tudo bem";

const withNote = (ctx: ClientNotificationContext, text: string) =>
  ctx.clientNote ? `${text}\n\nRecado da equipe: ${ctx.clientNote}` : text;

export const CLIENT_STATUS_COPY: Partial<Record<TrafegoOrderStatus, ClientStatusCopy>> = {
  ACCOUNT_REVIEW: {
    emailSubject: (ctx) => `${ctx.orderCode} · vamos analisar sua conta de anúncios`,
    title: "Análise da conta de tráfego",
    body: (ctx) =>
      withNote(
        ctx,
        [
          `Oi, ${firstName(ctx.clientName)}! Sua campanha ${ctx.orderCode} já está com a nossa equipe.`,
          "O primeiro passo é verificar sua conta de anúncios. Se você já tem BM, adicione a Órbita como parceira em Configurações do negócio → Parceiros" +
            (ctx.partnerBusinessId ? ` usando o ID ${ctx.partnerBusinessId}.` : ".") +
            " Se não tem, nós criamos para você.",
          "Enquanto isso, você já pode enviar os criativos e a copy pelo painel.",
        ].join("\n\n"),
      ),
  },
  ONBOARDING: {
    emailSubject: (ctx) => `${ctx.orderCode} · conta verificada, envie seus materiais`,
    title: "Aguardando seus materiais",
    body: (ctx) =>
      withNote(
        ctx,
        `Conta verificada, ${firstName(ctx.clientName)}! Agora falta você enviar os criativos e escolher a copy no painel. Assim que estiver tudo lá, é só clicar em "Ativar campanha".`,
      ),
  },
  IN_REVIEW: {
    emailSubject: (ctx) => `${ctx.orderCode} · sua campanha está em análise`,
    title: "Em análise",
    body: (ctx) =>
      withNote(
        ctx,
        `${firstName(ctx.clientName)}, nossa equipe está revisando os materiais da campanha ${ctx.orderCode}. Se precisarmos de algum ajuste, avisamos por aqui.`,
      ),
  },
  CHANGES_REQUESTED: {
    emailSubject: (ctx) => `${ctx.orderCode} · precisamos de um ajuste`,
    title: "Ajustes solicitados",
    body: (ctx) =>
      withNote(
        ctx,
        `${firstName(ctx.clientName)}, encontramos algo que precisa ser ajustado antes da campanha ${ctx.orderCode} ir ao ar. Os detalhes estão no painel — depois de corrigir, clique em "Ativar campanha" de novo.`,
      ),
  },
  SCHEDULED: {
    emailSubject: (ctx) => `${ctx.orderCode} · campanha aprovada e agendada`,
    title: "Agendada",
    body: (ctx) =>
      withNote(
        ctx,
        `Boa notícia, ${firstName(ctx.clientName)}: a campanha ${ctx.orderCode} foi aprovada e está agendada. Você recebe outro aviso quando ela entrar no ar.`,
      ),
  },
  RUNNING: {
    emailSubject: (ctx) => `${ctx.orderCode} · sua campanha está no ar 🚀`,
    title: "No ar",
    body: (ctx) =>
      withNote(
        ctx,
        `${firstName(ctx.clientName)}, a campanha ${ctx.orderCode} está no ar! Acompanhe os números na aba Desempenho do painel. Os primeiros dias são de aprendizado do algoritmo — os resultados estabilizam a partir da segunda semana.`,
      ),
  },
  PAUSED: {
    emailSubject: (ctx) => `${ctx.orderCode} · campanha pausada`,
    title: "Pausada",
    body: (ctx) =>
      withNote(
        ctx,
        `${firstName(ctx.clientName)}, a campanha ${ctx.orderCode} foi pausada. O motivo está no painel; fale com a equipe se tiver dúvida.`,
      ),
  },
  COMPLETED: {
    emailSubject: (ctx) => `${ctx.orderCode} · campanha concluída`,
    title: "Concluída",
    body: (ctx) =>
      withNote(
        ctx,
        `${firstName(ctx.clientName)}, a campanha ${ctx.orderCode} chegou ao fim do período contratado. O relatório final está no painel. Quer continuar? É só contratar uma nova pelo site — o aprendizado da conta fica com você.`,
      ),
  },
  CANCELLED: {
    emailSubject: (ctx) => `${ctx.orderCode} · campanha cancelada`,
    title: "Cancelada",
    body: (ctx) =>
      withNote(
        ctx,
        `${firstName(ctx.clientName)}, a campanha ${ctx.orderCode} foi cancelada. Se não foi você quem pediu, fale com a equipe.`,
      ),
  },
  REFUNDED: {
    emailSubject: (ctx) => `${ctx.orderCode} · reembolso realizado`,
    title: "Reembolsada",
    body: (ctx) =>
      `${firstName(ctx.clientName)}, o reembolso da campanha ${ctx.orderCode} foi processado. O valor volta pelo mesmo meio de pagamento em até 10 dias úteis.`,
  },
};

/** Texto completo para WhatsApp (texto livre ou fallback Uazapi). */
export function buildClientWhatsappText(
  status: TrafegoOrderStatus,
  ctx: ClientNotificationContext,
): string | null {
  const copy = CLIENT_STATUS_COPY[status];
  if (!copy) return null;
  const support = ctx.supportWhatsapp ? `\n\nDúvidas? Responda esta mensagem.` : "";
  return `*${copy.title}* — ${ctx.orderCode}\n\n${copy.body(ctx)}\n\nAcompanhe no painel: ${ctx.panelUrl}${support}`;
}

/**
 * Parâmetros do template UTILITY `trafego_status`, na ordem dos placeholders:
 * {{1}} nome · {{2}} código · {{3}} fase · {{4}} link do painel.
 */
export function buildStatusTemplateParameters(
  status: TrafegoOrderStatus,
  ctx: ClientNotificationContext,
): string[] {
  return [firstName(ctx.clientName), ctx.orderCode, ORDER_STATUS_LABEL[status], ctx.panelUrl];
}
