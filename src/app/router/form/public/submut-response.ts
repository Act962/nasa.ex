import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";
import { inngest } from "@/inngest/client";
import { awardPoints } from "@/app/router/space-point/utils";
import { pusherServer } from "@/lib/pusher";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  trackingParamsSchema,
  trackingToLeadData,
  shouldLogUtmLanding,
} from "@/lib/tracking/tracking-params";
import { recordLeadEvent } from "@/features/leads/lib/history";

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
      tracking: trackingParamsSchema.optional(),
      // Tag a aplicar no lead recém-criado (Configurações > Modo passo-a-passo
      // > Botão "Próximo" > Adicionar tag). A validação de existência é feita
      // dentro da transação.
      nextActionTagId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const {
        id,
        response,
        tracking: trackingParams,
        nextActionTagId,
      } = input;
      const tagIds: string[] = Object.values(JSON.parse(response))
        .map((field: any) => field?.meta?.tagId)
        .filter((tagId): tagId is string => Boolean(tagId));

      // Coletados durante a transação pra retornar ao cliente (usado pelas
      // ações do botão "Próximo" do form: redirecionar pra outro form ou link
      // externo levando dados do lead).
      let outLeadId: string | null = null;
      let outLeadName: string | null = null;
      let outLeadEmail: string | null = null;
      let outLeadPhone: string | null = null;
      let outLeadPublicToken: string | null = null;

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
            outLeadId = existingLead.id;
            outLeadName = existingLead.name;
            outLeadEmail = existingLead.email;
            outLeadPhone = existingLead.phone;
            outLeadPublicToken =
              (existingLead as unknown as { publicToken?: string | null })
                .publicToken ?? null;
            // Lead já existia — registra o resubmit como evento, sem alterar UTMs
            // do "primeiro touch".
            await trackLeadEvent({
              leadId,
              kind: "form_submit",
              metadata: { formId: id, returning: true },
            });
          } else {
            const newLead = await tx.lead.create({
              data: {
                name: userName,
                email: userEmail,
                phone: userPhone,
                trackingId,
                statusId,
                source: "FORM",
                ...trackingToLeadData(trackingParams),
              },
            });
            await tx.leadTag.createMany({
              data: tagsFind.map((tag) => ({
                leadId: newLead.id,
                tagId: tag.id,
              })),
            });
            leadId = newLead.id;
            outLeadId = newLead.id;
            outLeadName = newLead.name;
            outLeadEmail = newLead.email;
            outLeadPhone = newLead.phone;
            outLeadPublicToken =
              (newLead as unknown as { publicToken?: string | null })
                .publicToken ?? null;

            await trackLeadEvent({
              leadId: newLead.id,
              kind: "form_submit",
              metadata: { formId: id },
            });
            if (shouldLogUtmLanding(trackingParams)) {
              await trackLeadEvent({
                leadId: newLead.id,
                kind: "utm_landing",
                metadata: {
                  utmSource: trackingParams?.utmSource,
                  utmMedium: trackingParams?.utmMedium,
                  utmCampaign: trackingParams?.utmCampaign,
                  utmContent: trackingParams?.utmContent,
                  utmTerm: trackingParams?.utmTerm,
                  landingPage: trackingParams?.landingPage,
                  referrer: trackingParams?.referrer,
                },
              });
            }

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
            formSubmissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true },
            },
          },
        });

        if (leadId) {
          const newResponseId = updatedForm.formSubmissions?.[0]?.id ?? null;
          await recordLeadEvent(
            {
              leadId,
              eventType: "FORM_SUBMITTED",
              metadata: newResponseId
                ? { formResponseId: newResponseId, formId: id }
                : { formId: id },
            },
            tx,
          );

          // Action: "add_tag" do botão Próximo — aplica tag escolhida no lead.
          // Idempotente: ignora se já existir.
          if (nextActionTagId) {
            const tagExists = await tx.tag.findUnique({
              where: { id: nextActionTagId },
              select: { id: true },
            });
            if (tagExists) {
              await tx.leadTag.upsert({
                where: {
                  leadId_tagId: {
                    leadId,
                    tagId: nextActionTagId,
                  },
                },
                create: { leadId, tagId: nextActionTagId },
                update: {},
              });
              await recordLeadEvent(
                {
                  leadId,
                  eventType: "TAG_ADDED",
                  metadata: { tagId: nextActionTagId, source: "form_next_button" },
                },
                tx,
              );
            }
          }

          // Se ainda não temos publicToken (lead novo criado nesta tx sem
          // generatePublicLink), tentamos buscar agora — opcional.
          if (!outLeadPublicToken) {
            const refreshed = await tx.lead.findUnique({
              where: { id: leadId },
              select: { publicToken: true },
            });
            outLeadPublicToken = refreshed?.publicToken ?? null;
          }
        }

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

      // Log activity (form owner como ator — submissão pública)
      try {
        const formMeta = await prisma.form.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            organizationId: true,
            createdBy: { select: { id: true, name: true, email: true, image: true } },
          },
        });
        if (formMeta?.createdBy) {
          await logActivity({
            organizationId: formMeta.organizationId,
            userId: formMeta.createdBy.id,
            userName: formMeta.createdBy.name,
            userEmail: formMeta.createdBy.email,
            userImage: formMeta.createdBy.image,
            appSlug: "forms",
            subAppSlug: "forms-responses",
            featureKey: "forms.response.submitted",
            action: "forms.response.submitted",
            actionLabel: `Resposta recebida no formulário "${formMeta.name}"`,
            resource: formMeta.name,
            resourceId: formMeta.id,
            metadata: { isPublicSubmission: true },
          });
        }
      } catch (logErr) {
        console.error("[form/submit] logActivity error:", logErr);
      }

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
        lead: outLeadId
          ? {
              id: outLeadId,
              name: outLeadName,
              email: outLeadEmail,
              phone: outLeadPhone,
              publicToken: outLeadPublicToken,
            }
          : null,
      };
    } catch (error) {
      console.log(error);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
