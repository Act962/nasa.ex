import { pusherServer } from "@/lib/pusher";
import type { RealtimePublisher } from "./types";

/**
 * Adapter Pusher (server) da porta `RealtimePublisher`.
 *
 * Engole erros de transporte (log + segue): um broadcast de realtime nunca
 * deve derrubar o fluxo de negócio que o disparou (mover lead, etc.). Esta é
 * a responsabilidade que antes ficava no `safePublish` do domínio.
 */
export class PusherRealtimePublisher implements RealtimePublisher {
  async publish(
    channel: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    try {
      await pusherServer.trigger(channel, event, payload);
    } catch (error) {
      console.error(
        `[realtime] publish failed (channel=${channel} event=${event})`,
        error,
      );
    }
  }
}
