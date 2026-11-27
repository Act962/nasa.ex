import "server-only";
import { channelLookup, socialLogger } from "@/modules/social";
import { processChannelEvents } from "@/modules/social/process-channel-events";
import { ingestInstagramEventToChat } from "@/features/tracking-chat/server/instagram/ingest-instagram-event";
import type { Channel, InboundEvent } from "@/modules/social/domain/types";

/** Uma entrega da Meta traz poucas contas; o teto evita que um POST anônimo vire milhares de consultas. */
const MAX_ACCOUNTS_PER_DELIVERY = 50;

/**
 * Entrega cada evento à conta do `entry.id`. `acceptChannel` decide se a conta pode ser
 * atendida por este webhook (modo de conexão, assinatura). Falha de uma conta não derruba as
 * outras: a Meta reentregaria o lote inteiro, inclusive o que já foi respondido.
 */
export async function dispatchInstagramEventsByAccount(
  events: InboundEvent[],
  acceptChannel: (channel: Channel) => boolean,
): Promise<void> {
  const eventsByAccount = new Map<string, InboundEvent[]>();
  for (const event of events) {
    eventsByAccount.set(event.externalAccountId, [...(eventsByAccount.get(event.externalAccountId) ?? []), event]);
  }
  if (eventsByAccount.size > MAX_ACCOUNTS_PER_DELIVERY) {
    socialLogger.warn("Webhook do Instagram com contas demais; excedente ignorado", { accountCount: eventsByAccount.size });
  }

  const accountIds = [...eventsByAccount.keys()].slice(0, MAX_ACCOUNTS_PER_DELIVERY);
  const foundChannels = await channelLookup.findManyByExternalAccountIds("INSTAGRAM", accountIds);

  for (const found of foundChannels) {
    if (!acceptChannel(found.channel)) continue;
    try {
      await processChannelEvents(found, eventsByAccount.get(found.channel.externalAccountId) ?? [], ingestInstagramEventToChat);
    } catch (error) {
      socialLogger.error("Falha ao processar a conta no webhook do Instagram", {
        channelId: found.channel.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
