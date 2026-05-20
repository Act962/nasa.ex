import type { ToolSet } from "ai";
import type { AgentContext } from "../../lib/context";
import { makeSendAudioTool } from "./send-audio";
import { makeSendDocumentTool } from "./send-document";
import { makeFinishConversationTool } from "./finish-conversation";
import { makeTransferToHumanTool } from "./transfer-to-human";
import { makeAddTagsToLeadTool } from "./add-tags-to-lead";

export function buildAgentTools(ctx: AgentContext): ToolSet {
  const tools: ToolSet = {
    send_audio: makeSendAudioTool(ctx),
    send_document: makeSendDocumentTool(ctx),
    finish_conversation: makeFinishConversationTool(ctx),
    transfer_to_human: makeTransferToHumanTool(ctx),
  };

  // Tag tool só é exposta quando há catálogo — evita que o modelo invente
  // chamadas pra IDs que não existem em organizações sem tag com descrição.
  if (ctx.availableTags.length > 0) {
    tools.add_tags_to_lead = makeAddTagsToLeadTool(ctx);
  }

  return tools;
}
