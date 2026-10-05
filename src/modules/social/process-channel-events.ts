import "server-only";
import type { TenantScope } from "@/modules/shared/domain/tenant-scope";
import { handleInboundEvent, type HandleInboundEventResult } from "./application/handle-inbound-event";
import type { Channel, InboundEvent } from "./domain/types";
import {
  createChannelGateway,
  createSocialRepositories,
  socialClock,
  socialLogger,
  socialPicker,
} from "./index";

/** Roda as automações para os eventos de um canal. Usado pelo webhook por conexão e pelo webhook único da Meta. */
/** Chamado depois da automação de cada evento — o tracking-chat usa para montar a conversa (spec 0062). */
export type ChannelEventObserver = (input: {
  channel: Channel;
  event: InboundEvent;
  result: HandleInboundEventResult | null;
}) => Promise<void>;

export async function processChannelEvents(
  found: { channel: Channel; tenant: TenantScope },
  events: InboundEvent[],
  observer?: ChannelEventObserver,
): Promise<void> {
  const { channel, tenant } = found;
  const repositories = createSocialRepositories(tenant);
  const gateway = createChannelGateway(channel);

  for (const event of events) {
    let result: HandleInboundEventResult | null = null;
    try {
      result = await handleInboundEvent(event, {
        channel,
        automations: repositories.automations,
        inboundEvents: repositories.inboundEvents,
        runs: repositories.runs,
        contacts: repositories.contacts,
        gateway,
        ai: repositories.ai,
        clock: socialClock,
        picker: socialPicker,
        logger: socialLogger,
      });

      if (result.outcome === "FAILED" && result.authError) {
        await repositories.channels.markNeedsReconnect(channel.id, result.error);
      }
    } catch (error) {
      // Uma falha num evento não pode derrubar o lote: a Meta reentregaria
      // todos, inclusive os que já foram respondidos.
      socialLogger.error("Falha ao processar evento", {
        channelId: channel.id,
        externalEventId: event.externalEventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!observer) continue;
    try {
      await observer({ channel, event, result });
    } catch (error) {
      // O chat é efeito colateral: nunca derruba a automação nem o lote (RNF-1 da spec 0062).
      socialLogger.error("Falha no observador do evento", {
        channelId: channel.id,
        externalEventId: event.externalEventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
