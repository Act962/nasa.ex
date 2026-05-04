import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import { LeadAction, StatusFlow } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead";
import { validWhatsappPhone } from "@/http/uazapi/valid-whatsapp-phone";
import { ValidWhatsappPhoneResponse } from "@/http/uazapi/types";
import { logActivity } from "@/lib/activity-logger";

export const createLeadWithTags = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().optional(),
      description: z.string().optional(),
      statusId: z.string(),
      trackingId: z.string(),
      responsibleId: z.string().optional(),
      position: z.enum(["first", "last"]).default("last"),
      tagIds: z.array(z.string()).optional(),
      validateNumber: z.boolean().default(false),
      orgProjectId: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    return await prisma.$transaction(async (tx) => {
      // Verificar se já existe
      const existingLead = await tx.lead.findUnique({
        where: {
          phone_trackingId: {
            phone: input.phone,
            trackingId: input.trackingId,
          },
        },
      });

      if (existingLead) {
        throw errors.BAD_REQUEST({
          message: "Lead já existente com este contato",
          cause: "LEAD_ALREADY_EXISTS",
        });
      }

      let validatedPhone: ValidWhatsappPhoneResponse[] = [];

      // Validate number
      if (input.validateNumber) {
        const tracking = await tx.tracking.findUnique({
          where: {
            id: input.trackingId,
          },
          select: {
            whatsappInstance: {
              select: {
                apiKey: true,
              },
            },
          },
        });

        if (!tracking?.whatsappInstance?.apiKey) {
          throw errors.BAD_REQUEST({
            message:
              "Error: Não é possível validar números de WhatsApp. Confira sua instância",
            cause: "TRACKING_WITHOUT_API_KEY",
          });
        }

        validatedPhone = await validWhatsappPhone({
          token: tracking.whatsappInstance.apiKey,
          data: { numbers: [input.phone] },
        });

        if (!validatedPhone[0].isInWhatsapp) {
          throw errors.BAD_REQUEST({
            message: "Número não é válido",
            cause: "INVALID_PHONE",
          });
        }
      }

      // Determinar ordem baseado na posição
      let newOrder: Decimal;

      if (input.position === "first") {
        // Incrementar todos os outros
        await tx.lead.updateMany({
          where: {
            statusId: input.statusId,
            trackingId: input.trackingId,
          },
          data: { order: { increment: 1 } },
        });
        newOrder = new Decimal(0);
      } else {
        // Buscar último
        const lastLead = await tx.lead.findFirst({
          where: {
            statusId: input.statusId,
            trackingId: input.trackingId,
          },
          orderBy: { order: "desc" },
          select: { order: true },
        });
        newOrder = lastLead
          ? new Decimal(lastLead.order).plus(1)
          : new Decimal(0);
      }

      const responsibleId = input.responsibleId || context.user.id;

      // Criar lead
      const lead = await tx.lead.create({
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          description: input.description,
          statusId: input.statusId,
          trackingId: input.trackingId,
          order: newOrder,
          responsibleId,
          orgProjectId: input.orgProjectId,
          statusFlow: StatusFlow.NEW,
        },
        include: {
          tracking: {
            select: {
              organizationId: true,
              name: true,
            },
          },
        },
      });

      if (input.validateNumber) {
        await tx.conversation.upsert({
          where: {
            leadId_trackingId: {
              leadId: lead.id,
              trackingId: input.trackingId,
            },
          },
          create: {
            leadId: lead.id,
            trackingId: input.trackingId,
            remoteJid:
              validatedPhone[0].jid ||
              `${validatedPhone[0].query}@s.whatsapp.net`,
          },
          update: {},
        });
      }

      // Adicionar tags se fornecidas
      if (input.tagIds && input.tagIds.length > 0) {
        await tx.leadTag.createMany({
          data: input.tagIds.map((tagId) => ({
            leadId: lead.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      await recordLeadHistory({
        leadId: lead.id,
        userId: context.user.id,
        action: LeadAction.ACTIVE,
        notes: "Lead criado",
        tx,
      });

      if (lead.tracking) {
        await logActivity({
          organizationId: lead.tracking.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "tracking",
          subAppSlug: "tracking-pipeline",
          featureKey: "lead.created",
          action: "lead.created",
          actionLabel: `Criou o lead "${input.name}"`,
          resource: input.name,
          resourceId: lead.id,
          metadata: { phone: input.phone, trackingName: lead.tracking.name, hasTags: (input.tagIds?.length ?? 0) > 0 },
        });
      }

      return { lead };
    });
  });
