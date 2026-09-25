import "server-only";
import type {
  NotificationChannel,
  NotificationChannelResult,
  NotificationInput,
  NotificationResult,
  NotificationService,
} from "./types";

/**
 * Despachante de notificações. Não conhece caso de uso nem canal concreto:
 * recebe canais por construtor e escolhe entre eles pelo nome.
 *
 * Entrega é best-effort por desenho (spec 0022, RNF-1): um canal fora do ar não
 * pode derrubar quem chamou, do mesmo jeito que o Pusher já não derruba.
 */
export class ChannelNotificationService implements NotificationService {
  constructor(private readonly channels: NotificationChannel[]) {}

  async send(input: NotificationInput): Promise<NotificationResult> {
    const requested = input.channels
      ? this.channels.filter((channel) => input.channels!.includes(channel.name))
      : this.channels;

    const results = await Promise.all(
      requested.map((channel) => this.sendVia(channel, input)),
    );

    return { results };
  }

  private async sendVia(
    channel: NotificationChannel,
    input: NotificationInput,
  ): Promise<NotificationChannelResult> {
    if (!channel.isAvailable()) {
      return {
        channel: channel.name,
        sent: 0,
        failed: 0,
        skipped: true,
        reason: "Canal indisponível",
      };
    }

    try {
      return await channel.send(input);
    } catch (error) {
      console.error(`[notifications] canal ${channel.name} falhou:`, error);
      return {
        channel: channel.name,
        sent: 0,
        failed: input.userIds.length,
        skipped: false,
        reason: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }
}
