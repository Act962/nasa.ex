import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { managementLabels } from "@/http/uazapi/management-labels";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { recordLeadEvent } from "@/features/leads/lib/history";

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
  .handler(async ({ input, errors, context }) => {
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

      const result = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.update({
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

        await recordLeadHistory({
          leadId: input.id,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: "Tags do lead sincronizadas via WhatsApp",
          tx,
        });

        // Diff de tags pra emitir TAG_ADDED/TAG_REMOVED apenas pra mudanças.
        const previousTagIds = new Set(
          leadExists.leadTags.map((lt) => lt.tag.id),
        );
        const newTagIds = new Set(validTagIds);
        const added = validTagIds.filter((id) => !previousTagIds.has(id));
        const removed = Array.from(previousTagIds).filter(
          (id) => !newTagIds.has(id),
        );

        await Promise.all([
          ...added.map((tagId) =>
            recordLeadEvent(
              {
                leadId: input.id,
                eventType: "TAG_ADDED",
                userId: context.user.id,
                metadata: { tagId, source: "whatsapp_sync" },
              },
              tx,
            ),
          ),
          ...removed.map((tagId) =>
            recordLeadEvent(
              {
                leadId: input.id,
                eventType: "TAG_REMOVED",
                userId: context.user.id,
                metadata: { tagId, source: "whatsapp_sync" },
              },
              tx,
            ),
          ),
        ]);

        return lead;
      });

      const lead = result;

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
