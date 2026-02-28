import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { validWhatsappPhone } from "@/http/uazapi/valid-whatsapp-phone";
import prisma from "@/lib/prisma";
import z from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "../leads/utils/history";
import { Decimal } from "@prisma/client/runtime/client";

export const createConversation = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/conversation/create",
    summary: "Create conversation",
  })
  .input(
    z.object({
      trackingId: z.string(),
      phone: z.array(z.string()),
      token: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const { trackingId, phone, token } = input;

      const validPhones = await validWhatsappPhone({
        token,
        data: { numbers: phone },
      });

      let count = 0;
      const contactsInvalids: string[] = [];

      await Promise.all(
        validPhones.map(async (validPhone) => {
          try {
            if (validPhone.isInWhatsapp) {
              count++;
              let lead = await prisma.lead.findUnique({
                where: {
                  phone_trackingId: {
                    trackingId,
                    phone: validPhone.query,
                  },
                },
                select: {
                  id: true,
                },
              });

              if (!lead) {
                return;
              }

              await prisma.conversation.upsert({
                where: {
                  leadId_trackingId: {
                    leadId: lead.id,
                    trackingId,
                  },
                },
                create: {
                  trackingId,
                  leadId: lead.id,
                  remoteJid:
                    validPhone.jid || `${validPhone.query}@s.whatsapp.net`,
                },
                update: {},
              });

              await recordLeadHistory({
                leadId: lead.id,
                userId: context.user.id,
                action: LeadAction.ACTIVE,
                notes: "Conversa iniciada",
              });

              return;
            }
            contactsInvalids.push(validPhone.query);
          } catch (error) {
            console.error(error);
          }
        }),
      );

      return {
        message: `${count} conversas criadas!`,
        contactsInvalids,
      };
    } catch (error) {
      console.error(error);
      return { message: `Erro ao criar conversas` };
    }
  });
