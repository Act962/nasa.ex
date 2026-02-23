import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { managementLabels } from "@/http/uazapi/management-labels";

// 🟦 UPDATE
export const updateWhatsappTagsLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update whatsapp tags of an existing lead",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        id: z.string(),
        tagIds: z.array(z.string()),
        apiKey: z.string(),
      })
      .refine((v) => v.tagIds !== undefined, {
        message: "No fields to update",
        path: ["id"],
      }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const leadExists = await prisma.lead.findUnique({
        where: { id: input.id },
        include: {
          conversation: true,
          leadTags: {
            include: {
              tag: true,
            },
          },
        },
      });

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      // Validar quais tagIds realmente existem no banco de dados para evitar erro de Foreign Key
      const validTags = await prisma.tag.findMany({
        where: {
          id: { in: input.tagIds },
        },
        select: { id: true },
      });

      const validTagIds = validTags.map((t) => t.id);

      const lead = await prisma.lead.update({
        where: { id: input.id },
        data: {
          leadTags: {
            deleteMany: {},
            create: validTagIds.map((tagId) => ({
              tagId,
            })),
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          description: true,
          statusId: true,
          trackingId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const WhatsAppInstance = await prisma.whatsAppInstance.findUnique({
        where: {
          apiKey: input.apiKey,
        },
      });

      if (!WhatsAppInstance || !WhatsAppInstance.isBusiness) {
        throw errors.NOT_FOUND;
      }

      const whatsappTags = await prisma.tag.findMany({
        where: {
          whatsappId: { not: null },
          id: {
            in: validTagIds,
          },
        },
      });

      const currentWhatsappLabelIds = leadExists.leadTags
        .map((lt) => lt.tag.whatsappId)
        .filter((id): id is string => !!id);

      const targetWhatsappLabelIds = whatsappTags
        .map((tag) => tag.whatsappId)
        .filter((id): id is string => !!id);

      const targetNumber =
        leadExists.phone || leadExists.conversation?.remoteJid;

      if (targetNumber) {
        // Lógica solicitada: Para cada tag na lista, se não estiver na lista do WhatsApp, adiciona. Se já estiver, remove.
        for (const labelId of targetWhatsappLabelIds) {
          const alreadyHas = currentWhatsappLabelIds.includes(labelId);

          await managementLabels({
            token: input.apiKey,
            baseUrl: WhatsAppInstance.baseUrl,
            data: {
              number: targetNumber,
              add_labelid: !alreadyHas ? labelId : undefined,
              remove_labelid: alreadyHas ? labelId : undefined,
            },
          }).catch((err) => {
            console.error(
              `Erro ao ${alreadyHas ? "remover" : "adicionar"} label ${labelId} no WhatsApp:`,
              err,
            );
          });
        }
      }

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
