/**
 * Composition root da camada de realtime.
 *
 * Único lugar que conhece a lib concreta. Trocar Pusher por outra lib
 * (Ably, Inngest, websocket próprio) = trocar os adapters abaixo, sem mexer
 * em nenhum domínio que consome `realtimePublisher`/`realtimeSubscriber`.
 *
 * Observação: o registry de authorizers (`channel-authorizers.ts`) e os
 * adapters server (`pusher-publisher`) puxam código server-only (prisma /
 * pacote `pusher`); por isso NÃO são re-exportados aqui. Importe-os pelo
 * caminho direto onde for usado no servidor.
 */
import { PusherRealtimePublisher } from "./pusher-publisher";
import { PusherRealtimeSubscriber } from "./pusher-subscriber";
import type { RealtimePublisher, RealtimeSubscriber } from "./types";

export const realtimePublisher: RealtimePublisher =
  new PusherRealtimePublisher();

export const realtimeSubscriber: RealtimeSubscriber =
  new PusherRealtimeSubscriber();

export type {
  RealtimePublisher,
  RealtimeSubscriber,
  RealtimeChannelSubscription,
  ChannelAuthorizer,
} from "./types";
