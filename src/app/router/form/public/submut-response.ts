import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";
import { inngest } from "@/inngest/client";
import type { WhatsappChat } from "@/features/form/types";
import { awardPoints } from "@/app/router/space-point/utils";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  trackingParamsSchema,
  trackingToLeadData,
  shouldLogUtmLanding,
} from "@/lib/tracking/tracking-params";
import {
  recordLeadEvent,
  type RecordLeadEventInput,
} from "@/features/leads/lib/history";
import { deriveResponseLabel } from "@/features/form/lib/derive-response-label";

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
      nextActionTagId: z.string().optional().nullable(),
      responseId: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const {
        id,
        response,
        tracking: trackingParams,
        nextActionTagId,
        responseId: finalizingResponseId,
      } = input;
      const tagIds: string[] = Object.values(JSON.parse(response))
        .map((field: any) => field?.meta?.tagId)
        .filter((tagId): tagId is string => Boolean(tagId));
      let outLeadId: string | null = null;
      let outLeadName: string | null = null;
      let outLeadEmail: string | null = null;
      let outLeadPhone: string | null = null;
      let outLeadPublicToken: string | null = null;

      const pendingLeadEvents: RecordLeadEventInput[] = [];

      const { formMeta } = await prisma.$transaction(async (tx) => {
        const rawForm = await tx.form.findUnique({
          where: {
            id,
            published: true,
          },
          select: {
            name: true,
            jsonBlock: true,
            settings: {
              select: {
                trackingId: true,
                statusId: true,
                whatsappChats: true,
                whatsappMessage: true,
              },
            },
          },
        });

        if (!rawForm) {
          throw errors.NOT_FOUND();
        }

        // Casta apenas whatsappChats de Prisma.JsonValue para o tipo concreto,
        // mantendo todos os outros campos com os tipos originais do Prisma.
        const form = {
          ...rawForm,
          settings: rawForm.settings
            ? {
                ...rawForm.settings,
                whatsappChats: (rawForm.settings.whatsappChats ??
                  []) as WhatsappChat[],
              }
            : null,
        };

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

        if (finalizingResponseId) {
          const draft = await tx.formResponses.findFirst({
            where: { id: finalizingResponseId, formId: id },
            select: { id: true, leadId: true },
          });
          if (!draft) {
            throw errors.NOT_FOUND({ message: "Draft não encontrado" });
          }
          if (draft.leadId) {
            const draftLead = await tx.lead.findUnique({
              where: { id: draft.leadId },
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                publicToken: true,
              },
            });
            if (draftLead) {
              leadId = draftLead.id;
              outLeadId = draftLead.id;
              outLeadName = draftLead.name;
              outLeadEmail = draftLead.email;
              outLeadPhone = draftLead.phone;
              outLeadPublicToken =
                (draftLead as unknown as { publicToken?: string | null })
                  .publicToken ?? null;
              // Garante que tags vindas das respostas (radio com tagId) sejam
              // aplicadas — savePartial não toca em tags.
              if (tagsFind.length > 0) {
                await tx.leadTag.createMany({
                  data: tagsFind.map((tag) => ({
                    leadId: draftLead.id,
                    tagId: tag.id,
                  })),
                  skipDuplicates: true,
                });
              }
              await trackLeadEvent({
                leadId,
                kind: "form_submit",
                metadata: { formId: id, finalized: true },
              });
            }
          }
        } else if (trackingId && statusId) {
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

        // Auto-deriva o título customizado da resposta (label) a partir do
        // bloco do form marcado com `attributes.useAsResponseLabel`. Submit
        // público sempre nasce com `labelManuallyEdited=false` (default).
        const autoLabel = deriveResponseLabel({
          jsonBlock: form.jsonBlock,
          jsonResponse: response,
        });

        // Modo finalize: atualiza o draft existente em vez de criar duplicata.
        // NÃO incrementa o contador (já foi incrementado no save partial).
        let updatedForm: {
          responses: number;
          userId: string;
          organizationId: string;
          formSubmissions: { id: string; label: string | null }[];
        };
        if (finalizingResponseId) {
          await tx.formResponses.update({
            where: { id: finalizingResponseId },
            data: { jsonResponse: response, label: autoLabel },
          });
          const formAfter = await tx.form.findUnique({
            where: { id },
            select: {
              responses: true,
              userId: true,
              organizationId: true,
            },
          });
          updatedForm = {
            responses: formAfter?.responses ?? 0,
            userId: formAfter?.userId ?? "",
            organizationId: formAfter?.organizationId ?? "",
            formSubmissions: [
              { id: finalizingResponseId, label: autoLabel ?? null },
            ],
          };
        } else {
          updatedForm = await tx.form.update({
            where: {
              id,
              published: true,
            },
            data: {
              formSubmissions: {
                create: {
                  jsonResponse: response,
                  ...(leadId && { leadId }),
                  label: autoLabel,
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
                select: { id: true, label: true },
              },
            },
          });
        }

        if (leadId) {
          const lastSub = updatedForm.formSubmissions?.[0];
          const newResponseId = lastSub?.id ?? null;
          const newResponseLabel = lastSub?.label ?? null;
          pendingLeadEvents.push({
            leadId,
            eventType: "FORM_SUBMITTED",
            metadata: newResponseId
              ? {
                  formResponseId: newResponseId,
                  formId: id,
                  label: newResponseLabel,
                }
              : { formId: id, label: newResponseLabel },
          });

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
              pendingLeadEvents.push({
                leadId,
                eventType: "TAG_ADDED",
                metadata: {
                  tagId: nextActionTagId,
                  source: "form_next_button",
                },
              });
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

        return { formMeta: form };
      });

      // Dispara Pusher/journey FORA da tx — recordLeadEvent chama Pusher e
      // não pode rodar dentro do $transaction (causa timeout).
      if (pendingLeadEvents.length > 0) {
        await Promise.all(pendingLeadEvents.map((e) => recordLeadEvent(e)));
      }

      // Log activity (form owner como ator — submissão pública)
      try {
        const formMeta = await prisma.form.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            organizationId: true,
            createdBy: {
              select: { id: true, name: true, email: true, image: true },
            },
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

      // ── Notificação WhatsApp (fire-and-forget via Inngest) ────────────────
      try {
        const whatsappChats = formMeta.settings?.whatsappChats ?? [];
        const trackingId = formMeta.settings?.trackingId;

        if (whatsappChats.length > 0 && trackingId) {
          await inngest.send({
            name: "form/whatsapp.send",
            data: {
              formId: id,
              formName: formMeta.name,
              trackingId,
              whatsappChats,
              whatsappMessage: formMeta.settings?.whatsappMessage ?? null,
              leadData: {
                id: outLeadId,
                name: outLeadName,
                phone: outLeadPhone,
                email: outLeadEmail,
              },
            },
          });
        }
      } catch (whatsappErr) {
        console.error(
          "[form/submit] Inngest whatsapp send error:",
          whatsappErr,
        );
        // Não bloqueia o retorno do submit
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
