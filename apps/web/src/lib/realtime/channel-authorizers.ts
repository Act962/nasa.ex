import { boardLeadsAuthorizer } from "@/features/leads/realtime/board-leads-authorizer";
import type { ChannelAuthorizer } from "./types";

/**
 * Registry de authorizers de canais privados. Para expor um novo canal
 * privado, registre o seu `ChannelAuthorizer` aqui — sem tocar no endpoint
 * de auth (Open/Closed).
 */
const channelAuthorizers: ChannelAuthorizer[] = [boardLeadsAuthorizer];

/**
 * Tenta autorizar `channel` via registry.
 * - retorna `true`/`false` se algum authorizer reconhece o canal;
 * - retorna `null` se nenhum reconhece (deixa o caller decidir o fallback).
 */
export async function authorizeChannel(
  channel: string,
  userId: string,
): Promise<boolean | null> {
  const authorizer = channelAuthorizers.find((candidate) =>
    candidate.matches(channel),
  );
  if (!authorizer) return null;
  return authorizer.authorize(channel, userId);
}
