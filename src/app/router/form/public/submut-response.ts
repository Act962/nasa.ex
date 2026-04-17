import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { inngest } from "@/inngest/client";
import { awardPoints } from "@/app/router/space-point/utils";
import { pusherServer } from "@/lib/pusher";

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
      const tagIds: string[] = Object.values(JSON.parse(response))
        .map((field: any) => field?.meta?.tagId)
        .filter((tagId): tagId is string => Boolean(tagId));

      await prisma.$transaction(async (tx) => {
        const form = await tx.form.findUnique({
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

        let parsedResponse: Record<string, string> = {};
        try {
          parsedResponse = JSON.parse(response);
        } catch {}

        const userName = parsedResponse.user_name || "Sem nome";
        const userEmail = parsedResponse.user_email || null;
        const userPhone = parsedResponse.user_phone || null;

        let leadId: string | null = null;

        const tagsFind = await tx.tag.findMany({
          where: {
            id: {
              in: tagIds,
            },
          },
        });

        const { trackingId, statusId } = form.settings ?? {};

        if (trackingId && statusId) {
          let existingLead = null;
          if (userPhone) {
            existingLead = await tx.lead.findUnique({
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
            const newLead = await tx.lead.create({
              data: {
                name: userName,
                email: userEmail,
                phone: userPhone,
                trackingId,
                statusId,
                source: "FORM",
              },
            });
            await tx.leadTag.createMany({
              data: tagsFind.map((tag) => ({
                leadId: newLead.id,
                tagId: tag.id,
              })),
            });
            leadId = newLead.id;

            await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${trackingId}&leadId=${newLead.id}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ trackingId }),
              },
            );
          }
        }

        const updatedForm = await tx.form.update({
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
          select: {
            responses: true,
            userId: true,
            organizationId: true,
          },
        });

        // Gamificação em tempo real: Marcos de 10 e 100 respostas
        if (updatedForm.responses === 10 || updatedForm.responses === 100) {
          const action =
            updatedForm.responses === 10
              ? "form_10_responses"
              : "form_100_responses";

          try {
            await awardPoints(
              updatedForm.userId,
              updatedForm.organizationId,
              action,
              undefined,
              { formId: id },
            );
          } catch (spErr) {
            console.error("[form/submit] SpacePoint award error:", spErr);
            // Não bloqueia o submit do formulário se a pontuação falhar
          }
        }
      });

      // Verificar se este form faz parte de um processo de onboarding
      try {
        const onboardingProcess =
          await prisma.clientOnboardingProcess.findFirst({
            where: { OR: [{ brandFormId: id }, { onboardingFormId: id }] },
            select: { id: true, brandFormId: true },
          });
        if (onboardingProcess) {
          await inngest.send({
            name: "onboarding/form.submitted",
            data: {
              formId: id,
              onboardingProcessId: onboardingProcess.id,
              isBrandForm: onboardingProcess.brandFormId === id,
            },
          });
        }
      } catch (inngestErr) {
        console.error("[form/submit] Inngest send error:", inngestErr);
        // não bloqueia o submit do form
      }

      return {
        id,
        message: "Response submitted",
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
