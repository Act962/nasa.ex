import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

const fieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["lead", "form", "custom"]),
  formFieldId: z.string().optional(),
  formId: z.string().optional(),
});

export const updateTrackingCardConfig = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update card config of a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      fields: z.array(fieldSchema),
      showSlaTimer: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const data = {
        fields: input.fields,
        ...(input.showSlaTimer !== undefined && { showSlaTimer: input.showSlaTimer }),
      };

      const config = await (
        prisma as unknown as {
          trackingCardConfig: {
            upsert: (args: unknown) => Promise<unknown>;
          };
        }
      ).trackingCardConfig.upsert({
        where: { trackingId: input.trackingId },
        create: { trackingId: input.trackingId, ...data },
        update: data,
      });
      return { config };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
