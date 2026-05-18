import type { ToolSet } from "ai";
import type { AgentContext } from "../../lib/context";
import { makeSendImageTool } from "./send-image";
import { makeSendAudioTool } from "./send-audio";
import { makeSendDocumentTool } from "./send-document";
import { makeFinishConversationTool } from "./finish-conversation";
import { makeTransferToHumanTool } from "./transfer-to-human";

export function buildAgentTools(ctx: AgentContext): ToolSet {
  return {
    send_image: makeSendImageTool(ctx),
    send_audio: makeSendAudioTool(ctx),
    send_document: makeSendDocumentTool(ctx),
    finish_conversation: makeFinishConversationTool(ctx),
    transfer_to_human: makeTransferToHumanTool(ctx),
  };
}
