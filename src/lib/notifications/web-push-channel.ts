import "server-only";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import prisma from "@/lib/prisma";
import { loadVapidConfig } from "./vapid";
import type {
  NotificationChannel,
  NotificationChannelResult,
  NotificationContent,
  NotificationInput,
} from "./types";

/**
 * Adapter Web Push. Único arquivo do servidor que conhece a lib `web-push`.
 *
 * Trocar de provedor de push = trocar este arquivo, sem mexer em quem chama
 * `notificationService.send`.
 */

/** Limite prático do payload criptografado; o resto vira 413 (CB-5). */
const MAX_BODY_LENGTH = 400;

/** Códigos em que o push service diz que a inscrição morreu (spec 0022, D-4). */
const GONE_STATUS_CODES = new Set([404, 410]);

export class WebPushNotificationChannel implements NotificationChannel {
  readonly name = "web-push" as const;

  isAvailable(): boolean {
    return loadVapidConfig() !== null;
  }

  async send(input: NotificationInput): Promise<NotificationChannelResult> {
    const vapid = loadVapidConfig();
    if (!vapid) {
      return skipped("VAPID não configurado");
    }
    if (input.userIds.length === 0) {
      return skipped("Sem destinatários");
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: input.userIds } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) {
      return skipped("Nenhuma inscrição ativa");
    }

    const payload = JSON.stringify(buildPayload(input.notification));

    // Paralelo e isolado: uma inscrição morta não pode impedir as outras
    // (RNF-2). `allSettled` porque cada envio já trata o próprio erro.
    const outcomes = await Promise.allSettled(
      subscriptions.map((subscription) =>
        this.deliver(subscription, payload),
      ),
    );

    const sent = outcomes.filter(
      (outcome) => outcome.status === "fulfilled" && outcome.value,
    ).length;

    return {
      channel: this.name,
      sent,
      failed: subscriptions.length - sent,
      skipped: false,
    };
  }

  private async deliver(
    subscription: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: string,
  ): Promise<boolean> {
    const target: WebPushSubscription = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };

    try {
      await webpush.sendNotification(target, payload, { TTL: 60 * 60 * 24 });
      await prisma.pushSubscription
        .update({
          where: { id: subscription.id },
          data: { lastUsedAt: new Date(), failureCount: 0 },
        })
        .catch(() => {
          // A inscrição pode ter sido removida em paralelo. Não invalida o envio.
        });
      return true;
    } catch (error) {
      await this.handleFailure(subscription.id, error);
      return false;
    }
  }

  /**
   * 404/410 = inscrição morta, apaga. Qualquer outro código só conta falha:
   * um VAPID trocado por engano devolve 403 em todas, e apagar aqui zeraria a
   * base inteira por erro de configuração (spec 0022, D-4 / CB-9).
   */
  private async handleFailure(
    subscriptionId: string,
    error: unknown,
  ): Promise<void> {
    const statusCode = (error as { statusCode?: number })?.statusCode;

    if (statusCode && GONE_STATUS_CODES.has(statusCode)) {
      // deleteMany é idempotente: dois envios concorrentes podem apagar a
      // mesma linha sem que o segundo exploda (CB-10).
      await prisma.pushSubscription
        .deleteMany({ where: { id: subscriptionId } })
        .catch(() => {});
      return;
    }

    if (statusCode === 403) {
      console.error(
        "[notifications/web-push] 403 do push service — VAPID provavelmente trocado. Inscrição mantida.",
      );
    }

    await prisma.pushSubscription
      .update({
        where: { id: subscriptionId },
        data: { failureCount: { increment: 1 } },
      })
      .catch(() => {});
  }
}

function buildPayload(notification: NotificationContent) {
  return {
    title: notification.title,
    body: truncate(notification.body, MAX_BODY_LENGTH),
    url: notification.url ?? "/",
    tag: notification.tag ?? undefined,
    icon: notification.icon ?? "/favicon.png",
    data: notification.data ?? {},
  };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function skipped(reason: string): NotificationChannelResult {
  return { channel: "web-push", sent: 0, failed: 0, skipped: true, reason };
}
