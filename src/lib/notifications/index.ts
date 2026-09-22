import "server-only";
import { ChannelNotificationService } from "./notification-service";
import { WebPushNotificationChannel } from "./web-push-channel";
import type { NotificationService } from "./types";

/**
 * Composition root da camada de notificações.
 *
 * Único lugar que conhece os canais concretos. Acrescentar e-mail, SMS ou
 * WhatsApp = implementar `NotificationChannel` e registrar na lista abaixo;
 * nenhum módulo que chama `notificationService.send` muda.
 *
 * Mesma estrutura de `src/lib/realtime/index.ts`. É server-only: o adapter
 * puxa Prisma e a chave VAPID privada. O lado do browser vive em
 * `./client/push-client`, que não importa nada daqui.
 */
export const notificationService: NotificationService =
  new ChannelNotificationService([new WebPushNotificationChannel()]);

export type {
  NotificationService,
  NotificationChannel,
  NotificationChannelName,
  NotificationChannelResult,
  NotificationContent,
  NotificationInput,
  NotificationResult,
} from "./types";
