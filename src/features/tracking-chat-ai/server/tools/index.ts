import type { ToolSet } from "ai";
import type { AgentContext } from "../../lib/context";
import { makeSendAudioTool } from "./send-audio";
import { makeSendDocumentTool } from "./send-document";
import { makeFinishConversationTool } from "./finish-conversation";
import { makeTransferToHumanTool } from "./transfer-to-human";
import { makeAddTagsToLeadTool } from "./add-tags-to-lead";
import { makeSendButtonsTool } from "./send-buttons";
import { makeCatalogOrderTools } from "@/features/nerp-catalog/server/tools/catalog-order-tools";
import { makeStarFriendsTools } from "@/features/star-friends/server/tools";

export function buildAgentTools(ctx: AgentContext): ToolSet {
  const tools: ToolSet = {
    send_audio: makeSendAudioTool(ctx),
    send_document: makeSendDocumentTool(ctx),
    // finish_conversation: makeFinishConversationTool(ctx),
    transfer_to_human: makeTransferToHumanTool(ctx),
  };

  // Tag tool só é exposta quando há catálogo — evita que o modelo invente
  // chamadas pra IDs que não existem em organizações sem tag com descrição.
  if (ctx.availableTags.length > 0) {
    tools.add_tags_to_lead = makeAddTagsToLeadTool(ctx);
  }

  // Mesma estratégia das tags: só registra send_buttons se houver preset
  // ativo. Sem catálogo a IA não tem como inventar presetId válido.
  if (ctx.availableButtonPresets.length > 0) {
    tools.send_buttons = makeSendButtonsTool(ctx);
  }

  // Pedido do Catálogo online NERP em aberto: libera o fechamento (PIX/link
  // Asaas). Sem pedido, o modelo não enxerga essas ferramentas.
  if (ctx.catalogOrder) {
    Object.assign(
      tools,
      makeCatalogOrderTools({
        order: ctx.catalogOrder,
        conversationId: ctx.conversation.id,
        assistantName: ctx.settings?.assistantName ?? "Astro",
      }),
    );
  }

  if (ctx.starFriendsProgramName) {
    Object.assign(
      tools,
      makeStarFriendsTools({
        organizationId: ctx.organizationId,
        leadId: ctx.lead.id,
        programName: ctx.starFriendsProgramName,
      }),
    );
  }

  return tools;
}
