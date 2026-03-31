import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const submitResponse = base
  .route({
    method: "POST",
    path: "/forms/public/:id/submit",
    summary: "Submit a response to a published form",
  })
  .input(
    z.object({
      id: z.string(),
      response: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const { id, response } = input;

      const form = await prisma.form.findUnique({
        where: {
          id,
          published: true,
        },
        select: {
          settings: {
            select: {
              trackingId: true,
              statusId: true,
            },
          },
        },
      });

      if (!form) {
        throw errors.NOT_FOUND();
      }

      // Parseia os dados do response para extrair info do lead
      let parsedResponse: Record<string, string> = {};
      try {
        parsedResponse = JSON.parse(response);
      } catch {
        // Se não for JSON válido, segue sem criar lead
      }

      const userName = parsedResponse.user_name || "Sem nome";
      const userEmail = parsedResponse.user_email || null;
      const userPhone = parsedResponse.user_phone || null;

      let leadId: string | null = null;

      // Se o form tem tracking e status configurados, cria o lead
      const { trackingId, statusId } = form.settings ?? {};

      if (trackingId && statusId) {
        // Se tem telefone, tenta encontrar lead existente no mesmo tracking
        let existingLead = null;
        if (userPhone) {
          existingLead = await prisma.lead.findUnique({
            where: {
              phone_trackingId: {
                phone: userPhone,
                trackingId,
              },
            },
          });
        }

        if (existingLead) {
          leadId = existingLead.id;
        } else {
          const newLead = await prisma.lead.create({
            data: {
              name: userName,
              email: userEmail,
              phone: userPhone,
              trackingId,
              statusId,
              source: "FORM",
            },
          });
          leadId = newLead.id;
        }
      }

      // Salva a resposta do formulário e incrementa o contador
      await prisma.form.update({
        where: {
          id,
          published: true,
        },
        data: {
          formSubmissions: {
            create: {
              jsonResponse: response,
              ...(leadId && { leadId }),
            },
          },
          responses: {
            increment: 1,
          },
        },
      });

      return {
        id,
        message: "Response submitted",
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });

