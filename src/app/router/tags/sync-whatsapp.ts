import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getLabels } from "@/http/uazapi/list-labels";
import { randomUUID } from "crypto";

export const syncWhatsappTags = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Sync WhatsApp labels with database tags",
    tags: ["Tags"],
  })
  .input(
    z.object({
      apikey: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { apiKey: input.apikey },
      });

      if (!instance) {
        throw errors.NOT_FOUND;
      }

      if (!instance.isBusiness) {
        throw errors.BAD_REQUEST;
      }

      const labels = await getLabels({
        token: instance.apiKey,
        baseUrl: instance.baseUrl,
      });

      if (!labels) {
        return { createdTags: [] };
      }

      const existingTags = await prisma.tag.findMany({
        where: { organizationId: instance.organizationId },
      });

      const existingWhatsappIds = new Set(
        existingTags.map((t) => t.whatsappId).filter(Boolean),
      );

      const syncResult = [];

      for (const label of labels) {
        if (!existingWhatsappIds.has(label.id)) {
          const existingByName = existingTags.find(
            (t) =>
              t.name.toLowerCase() === label.name.toLowerCase() &&
              !t.whatsappId,
          );

          if (existingByName) {
            const updated = await prisma.tag.update({
              where: { id: existingByName.id },
              data: {
                whatsappId: label.id,
                color: label.colorHex,
              },
            });
            syncResult.push(updated);
          } else {
            const newTag = await prisma.tag.create({
              data: {
                name: label.name,
                color: label.colorHex,
                organizationId: instance.organizationId,
                whatsappId: label.id,
                trackingId: instance.trackingId,
                slug: `${label.name.toLowerCase()}-${randomUUID()}`,
              },
            });
            syncResult.push(newTag);
          }
        }
      }

      return { syncResult };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
