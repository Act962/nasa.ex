import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { z } from "zod";
import {
  resolveDisplaySurface,
  requiresAckBySeverity,
  type Severity,
  type DisplaySurface,
} from "@/features/alerts/lib/severity";

export const sendNotification = base
  .use(requireAdminMiddleware)
  .route({
    method: "POST",
    summary: "Admin — Send notification (com severity + popup urgente)",
    tags: ["Admin"],
  })
  .input(
    z.object({
      title: z.string().min(1).max(100),
      body: z.string().min(1).max(2000),
      type: z.enum(["info", "warning", "success", "error"]).default("info"),
      targetType: z.enum(["all", "org", "user"]).default("all"),
      targetId: z.string().optional().nullable(),
      actionUrl: z.string().url().optional().nullable(),
      appKey: z.string().optional().nullable(),
      // ── Camada de Alertas (opt-in) ──────────────────────────────────────
      severity: z.enum(["info", "warning", "critical"]).optional(),
      displaySurface: z.enum(["bell", "toast", "popup"]).optional(),
      requiresAck: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (
      (input.targetType === "org" || input.targetType === "user") &&
      !input.targetId
    ) {
      throw errors.BAD_REQUEST;
    }

    // Severity default: deriva do "type" legado quando omitido (warning/error → warning, success → info, info → info).
    const severity: Severity = input.severity ??
      (input.type === "error" || input.type === "warning"
        ? "warning"
        : "info");
    const displaySurface: DisplaySurface =
      input.displaySurface ?? resolveDisplaySurface(severity);
    const requiresAck = input.requiresAck ?? requiresAckBySeverity(severity);

    const notification = await prisma.adminNotification.create({
      data: {
        title: input.title,
        body: input.body,
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        actionUrl: input.actionUrl ?? null,
        appKey: input.appKey ?? null,
        createdBy: context.adminUser.id,
        severity,
        displaySurface,
        requiresAck,
      },
      select: { id: true },
    });

    // Pusher real-time pra entrega instantânea (sem esperar polling do bell).
    // Canal escolhido pelo targetType:
    //   - "user" → private-user-${targetId}
    //   - "org"  → private-org-${targetId}  (todos os membros assinam)
    //   - "all"  → não tem canal global; fica no polling do bell. (Quem
    //              estiver com a página aberta na hora vê quando o polling
    //              de 30s rodar; reload sempre vê.)
    try {
      const payload = {
        notificationId: notification.id,
        severity,
        displaySurface,
        requiresAck,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        eventType: "broadcast.manual",
      };
      if (input.targetType === "user" && input.targetId) {
        await pusherServer.trigger(
          `private-user-${input.targetId}`,
          "alert:new",
          payload,
        );
      } else if (input.targetType === "org" && input.targetId) {
        await pusherServer.trigger(
          `private-org-${input.targetId}`,
          "alert:new",
          payload,
        );
      }
    } catch (err) {
      console.error("[admin/send-notification] pusher trigger falhou:", err);
    }

    return { id: notification.id };
  });
