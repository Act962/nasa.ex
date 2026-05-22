import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { inngest } from "@/inngest/client";

const MAX_MINUTES = 60 * 24 * 90;

const messageModeSchema = z.enum(["NONE", "FIXED", "AI_REOPEN"]);

const scenarioPatchSchema = z.object({
  active: z.boolean().optional(),
  minutes: z.number().int().min(1).max(MAX_MINUTES).optional(),
  enableAi: z.boolean().optional(),
  messageMode: messageModeSchema.optional(),
  message: z.string().nullable().optional(),
  notifyResp: z.boolean().optional(),
  respTemplate: z.string().nullable().optional(),
});

export const updateTrackingIdleAutomation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update idle automation config of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      scenario: z.enum(["noFirstResp", "inConv"]),
      patch: scenarioPatchSchema,
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const prefix = input.scenario;
      const patch = input.patch;

      const data: Record<string, unknown> = {};
      if (patch.active !== undefined) data[`${prefix}Active`] = patch.active;
      if (patch.minutes !== undefined) data[`${prefix}Minutes`] = patch.minutes;
      if (patch.enableAi !== undefined)
        data[`${prefix}EnableAi`] = patch.enableAi;
      if (patch.messageMode !== undefined)
        data[`${prefix}MessageMode`] = patch.messageMode;
      if (patch.message !== undefined) data[`${prefix}Message`] = patch.message;
      if (patch.notifyResp !== undefined)
        data[`${prefix}NotifyResp`] = patch.notifyResp;
      if (patch.respTemplate !== undefined)
        data[`${prefix}RespTemplate`] = patch.respTemplate;

      const config = await prisma.trackingIdleAutomation.upsert({
        where: { trackingId: input.trackingId },
        create: { trackingId: input.trackingId, ...data },
        update: data,
      });

      // Se o toggle "ativo" foi desligado, cancela runs em sleep desse cenário
      // pra esse tracking (cancelOn das funcs Inngest mata na hora).
      if (patch.active === false) {
        await inngest.send({
          name: "idle/automation-disabled",
          data: {
            trackingId: input.trackingId,
            scenario: input.scenario,
          },
        });
      }

      return { config };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
