import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { notificationService } from "@/lib/notifications";
import { z } from "zod";

/**
 * Dispara um push para o próprio usuário. Existe para diagnóstico: separa
 * "o envio funciona" de "o browser exibe" sem depender de nenhum caso de uso.
 *
 * Só alcança quem chamou — não aceita destinatário como parâmetro.
 */
export const sendTestPush = base
  .use(requiredAuthMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const result = await notificationService.send({
      userIds: [context.user.id],
      notification: {
        title: "Teste de notificação",
        body: `Enviado às ${new Date().toLocaleTimeString("pt-BR")}. Se você está vendo isto, o caminho completo funciona.`,
        url: "/push-test",
        tag: `push-test:${Date.now()}`,
      },
      channels: ["web-push"],
    });

    const webPush = result.results.find(
      (channel) => channel.channel === "web-push",
    );

    return {
      sent: webPush?.sent ?? 0,
      failed: webPush?.failed ?? 0,
      skipped: webPush?.skipped ?? true,
      reason: webPush?.reason ?? null,
    };
  });
