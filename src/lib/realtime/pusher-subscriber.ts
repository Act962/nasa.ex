import { pusherClient } from "@/lib/pusher";
import type {
  RealtimeChannelSubscription,
  RealtimeSubscriber,
} from "./types";

/**
 * Adapter Pusher (client) da porta `RealtimeSubscriber`.
 *
 * Importante: o `pusherClient` é um singleton compartilhado por todo o app,
 * então cada subscription mantém seus próprios handlers para fazer
 * `unbind`/`unsubscribe` certinho no cleanup, sem afetar outras features que
 * porventura assinem o mesmo canal.
 */
class PusherChannelSubscription implements RealtimeChannelSubscription {
  private readonly handlers = new Map<string, (data: unknown) => void>();

  constructor(
    private readonly channelName: string,
    private readonly channel: ReturnType<typeof pusherClient.subscribe>,
  ) {}

  bind(event: string, handler: (data: unknown) => void): void {
    this.handlers.set(event, handler);
    this.channel.bind(event, handler);
  }

  unbindAll(): void {
    for (const [event, handler] of this.handlers) {
      this.channel.unbind(event, handler);
    }
    this.handlers.clear();
  }

  unsubscribe(): void {
    this.unbindAll();
    pusherClient.unsubscribe(this.channelName);
  }
}

export class PusherRealtimeSubscriber implements RealtimeSubscriber {
  subscribe(channel: string): RealtimeChannelSubscription {
    return new PusherChannelSubscription(channel, pusherClient.subscribe(channel));
  }
}
