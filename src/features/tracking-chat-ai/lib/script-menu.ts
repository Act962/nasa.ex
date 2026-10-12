import "server-only";
import prisma from "@/lib/prisma";
import { MENU_PRESET_NAME } from "./attendance-setup/script-draft";
import { makeSendButtonsTool } from "../server/tools/send-buttons";
import { clientMenuId, RETURNING_MENU_BODY } from "./guided-menu/menu-ids";
import type { AgentContext } from "./context";

// Menu inicial do roteiro (spec 0091): quando a conversa começa, a saudação e o menu saem pelo
// código, sem depender de a assistente decidir enviar. No teste real ela descreveu o menu em texto
// em vez de mandar a lista, e sem a lista o clique não aplica a tag que dispara o fluxo do assunto.

/** Conversa parada há este tempo conta como um contato novo. */
const FRESH_CONTACT_HOURS = 12;
/** Saudação curta ou pedido do menu: o menu volta mesmo no meio da conversa. */
const ASKS_FOR_MENU = /^(oi+|ola|opa|e ?ai|bom dia|boa tarde|boa noite|menu|inicio|comecar|opcoes)\b[\s!.,?]*$/;
const MENU_COOLDOWN_MS = 2 * 60_000;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Limite de linhas de uma lista na API oficial. */
const MAX_MENU_ROWS = 10;
const BUTTON_FORMAT_MAX = 3;

/**
 * Com o menu de botões ligado e agenda disponível, o menu do roteiro leva junto "Agendar" e "Meus
 * horários". Os cliques neles são do menu de botões (ids `cli:`), que marca sem IA.
 */
function withBookingRows(ctx: AgentContext, menuPreset: AgentContext["availableButtonPresets"][number]): AgentContext["availableButtonPresets"][number] {
  const canBook = ctx.capabilities.guidedMenu && ctx.capabilities.agenda.isEnabled && ctx.availableAgendas.length > 0;
  const topicRows = Array.isArray(menuPreset.buttons) ? menuPreset.buttons : [];
  if (!canBook || topicRows.length === 0) return menuPreset;
  const bookingRows = [
    { id: clientMenuId({ step: "book" }), text: "Agendar consulta" },
    { id: clientMenuId({ step: "mine" }), text: "Meus horários" },
  ].slice(0, Math.max(0, MAX_MENU_ROWS - topicRows.length));
  const rows = [...topicRows, ...bookingRows];
  return { ...menuPreset, buttons: rows as typeof menuPreset.buttons, menuFormat: rows.length > BUTTON_FORMAT_MAX ? "LIST" : menuPreset.menuFormat, listButton: menuPreset.listButton ?? "Ver opções" };
}

/** Folga para o relógio: a tag do clique é gravada instantes antes ou depois da mensagem. */
const CLICK_TAG_WINDOW_MS = 15_000;

async function didClickStartFlow(ctx: AgentContext, clickedAt: Date): Promise<boolean> {
  const freshTags = await prisma.leadTag.findMany({
    where: { leadId: ctx.lead.id, createdAt: { gte: new Date(clickedAt.getTime() - CLICK_TAG_WINDOW_MS) } },
    select: { tagId: true },
  });
  if (freshTags.length === 0) return false;
  const activeFlows = await prisma.workflow.findMany({
    where: { trackingId: ctx.trackingId, isActive: true, nodes: { some: { type: "LEAD_TAGGED" } } },
    select: { nodes: { where: { type: "LEAD_TAGGED" }, select: { data: true } } },
  });
  const triggerData = JSON.stringify(activeFlows.flatMap((flow) => flow.nodes.map((node) => node.data)));
  return freshTags.some((leadTag) => triggerData.includes(leadTag.tagId));
}

export async function handleScriptMenu(ctx: AgentContext, inboundMessageId: string): Promise<{ handled: boolean }> {
  if (ctx.catalogOrder || !ctx.lead.phone || !ctx.instance) return { handled: false };
  const menuPreset = ctx.availableButtonPresets.find((preset) => preset.name === MENU_PRESET_NAME);
  if (!menuPreset) return { handled: false };

  const inbound = await prisma.message.findFirst({
    where: { id: inboundMessageId, conversationId: ctx.conversation.id, fromMe: false },
    select: { body: true, mimetype: true, mediaType: true, metadata: true, createdAt: true },
  });
  // Áudio e arquivo seguem para a assistente: só texto abre a conversa com o menu.
  if (!inbound || inbound.mimetype || inbound.mediaType) return { handled: false };
  // Clique numa opção do menu: se a tag acabou de entrar e um fluxo ligado responde a ela, o fluxo já
  // manda a abertura do assunto. A assistente fica quieta, para o cliente não receber duas respostas.
  const clickedId = (inbound.metadata as { interactiveReplyId?: unknown } | null)?.interactiveReplyId;
  const isBackToMenuClick = clickedId === clientMenuId({ step: "menu" });
  if (clickedId && !isBackToMenuClick) {
    return { handled: await didClickStartFlow(ctx, inbound.createdAt) };
  }

  const asksForMenu = ASKS_FOR_MENU.test(normalize(inbound.body ?? ""));
  const earlierMessage = await prisma.message.findFirst({
    where: {
      conversationId: ctx.conversation.id,
      id: { not: inboundMessageId },
      createdAt: { gte: new Date(inbound.createdAt.getTime() - FRESH_CONTACT_HOURS * 60 * 60_000), lt: inbound.createdAt },
    },
    select: { id: true },
  });
  const isOngoingConversation = Boolean(earlierMessage);
  if (asksForMenu && !isBackToMenuClick) {
    // Dois "oi" seguidos não geram dois menus.
    const recentMenu = await prisma.message.findFirst({
      where: {
        conversationId: ctx.conversation.id,
        fromMe: true,
        createdAt: { gte: new Date(inbound.createdAt.getTime() - MENU_COOLDOWN_MS) },
        body: { contains: "[Menu]" },
      },
      select: { id: true },
    });
    if (recentMenu) return { handled: true };
  }
  // Conversa em andamento com outra pergunta: quem responde é a assistente, para não cortar a dúvida com o menu.
  if (!asksForMenu && !isBackToMenuClick && isOngoingConversation) return { handled: false };

  const menuToSend = withBookingRows(ctx, menuPreset);
  const sendPreset = makeSendButtonsTool({
    ...ctx,
    // No meio da conversa o menu volta sem a apresentação da assistente de novo.
    availableButtonPresets: [isOngoingConversation ? { ...menuToSend, bodyText: RETURNING_MENU_BODY } : menuToSend],
  }) as unknown as {
    execute: (input: { presetId: string }, options: { toolCallId: string; messages: [] }) => Promise<{ ok?: boolean; error?: string }>;
  };
  const sent = await sendPreset.execute({ presetId: menuPreset.id }, { toolCallId: `script-menu-${Date.now()}`, messages: [] });
  // Se o menu não saiu (ex.: limite do canal), a assistente responde no lugar.
  return { handled: sent.ok === true };
}
