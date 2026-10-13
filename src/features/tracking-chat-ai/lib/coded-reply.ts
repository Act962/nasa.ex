import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers";
import { toLegacyUazapiMessageId } from "@/features/tracking-chat/lib/providers/automated-outbound";
import { formatNumberedMenu, numberedMenuMetadata } from "@/features/tracking-chat/lib/numbered-menu";
import type { AgentContext } from "./context";
import { persistOutboundMessage } from "./persist";

// Resposta escrita pelo código, sem modelo: texto, ou texto com opções. No número oficial as opções
// saem como botões (até 3) ou lista (até 10); fora dele, como texto numerado (spec 0095).

export type CodedReplyOption = { id: string; title: string };

const MAX_BUTTON_OPTIONS = 3;

export async function sendCodedReply(
  ctx: AgentContext,
  reply: { body: string; options?: CodedReplyOption[]; metadata?: Record<string, Prisma.InputJsonValue> },
): Promise<void> {
  if (!ctx.lead.phone) return;
  const options = reply.options ?? [];
  const resolved = await resolveOutboundProvider(ctx.trackingId);
  const sendInteractive = resolved.uazapiToken ? undefined : resolved.provider.sendInteractive?.bind(resolved.provider);
  const persist = (body: string, externalMessageId: string, extraMetadata: Record<string, Prisma.InputJsonValue> = {}) => {
    const metadata = { ...extraMetadata, ...(reply.metadata ?? {}) };
    return persistOutboundMessage({
      conversationId: ctx.conversation.id,
      leadId: ctx.lead.id,
      trackingId: ctx.trackingId,
      body,
      senderName: ctx.settings?.assistantName ?? "IA",
      externalMessageId,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });
  };

  if (options.length > 0 && sendInteractive) {
    const sent = await sendInteractive({
      kind: "interactive",
      to: ctx.lead.phone,
      body: reply.body,
      options,
      listButtonLabel: options.length > MAX_BUTTON_OPTIONS ? "Ver opções" : undefined,
    });
    await persist(`${reply.body}\n\n[Menu]\n${options.map((option) => `• ${option.title}`).join("\n")}`, sent.externalMessageId);
    return;
  }
  const text = options.length > 0 ? formatNumberedMenu({ body: reply.body, options }) : reply.body;
  const sent = await resolved.provider.sendText({ kind: "text", to: ctx.lead.phone, body: text, typingDelayMs: 0 });
  await persist(text, toLegacyUazapiMessageId(sent), options.length > 0 ? numberedMenuMetadata(options) : {});
}
