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
  shouldLogUtmLanding,
} from "@/lib/tracking/tracking-params";
import {
  recordLeadEvent,
  type RecordLeadEventInput,
} from "@/features/leads/lib/history";
import {
  publishLeadCreated,
  publishLeadMoved,
} from "@/features/leads/realtime/publish";
import { deriveResponseLabel } from "@/features/form/lib/derive-response-label";
import { generateActionsForResponse } from "@/features/form/server/lib/generate-actions-for-response";
import { syncFormLabelsToLeadDescription } from "@/features/form/lib/sync-form-labels-to-lead-description";
import { eventBus } from "@/features/alerts/lib/event-bus";
import {
  resolveAndPlaceLeadForForm,
  placeLeadInFormTarget,
  type PlaceLeadResult,
} from "@/features/form/server/lib/resolve-and-place-lead-for-form";

type MovedLeadForBoard = {
  leadId: string;
  fromTrackingId: string | null;
  toTrackingId: string;
  fromStatusId: string | null;
  toStatusId: string;
};

type StatusChangeAlert = {
  leadId: string;
  fromStatusId: string | null;
  toStatusId: string;
  orgId: string;
  responsibleId: string | null;
};

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
      // Mod 2: lead reposicionado (movido de coluna ou realocado de tracking)
      // ao submeter — publicado no realtime + alerta APÓS o commit.
      let movedLeadForBoard: MovedLeadForBoard | null = null;
      let statusChangeAlert: StatusChangeAlert | null = null;
      // Id da resposta finalizada NESTA submissão (draft finalizado OU nova
      // submissão) + o lead a que ela pertence — usados pós-commit p/ gerar a
      // action da resposta CERTA (não "a mais recente por createdAt").
      let submittedResponseId: string | null = null;
      let submittedResponseLeadId: string | null = null;

      const { formMeta, createdLeadForBoard } = await prisma.$transaction(async (tx) => {
        // Lead novo criado nesta submissão (cai no board). Retornado da tx e
        // publicado no realtime APÓS o commit, pra o board refetchar a coluna
        // e o card aparecer ao vivo.
        let createdLeadForBoard: {
          leadId: string;
          trackingId: string;
          statusId: string;
        } | null = null;
        const rawForm = await tx.form.findUnique({
          where: {
            id,
            published: true,
          },
          select: {
            userId: true,
            name: true,
            jsonBlock: true,
            organizationId: true,
            settings: {
              select: {
                trackingId: true,
                statusId: true,
                whatsappChats: true,
                whatsappMessage: true,
                generateActionsConfig: true,
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

        // Mod 2: quando o lead é movido/realocado pro tracking/coluna do form,
        // coleta os efeitos de board/jornada/alerta pra disparar pós-commit.
        const collectPlacementSideEffects = async (placement: PlaceLeadResult) => {
          if (placement.outcome !== "moved" && placement.outcome !== "relocated") {
            return;
          }
          const fromStatusId = placement.from?.statusId ?? null;
          movedLeadForBoard = {
            leadId: placement.lead.id,
            fromTrackingId: placement.from?.trackingId ?? null,
            toTrackingId: placement.to.trackingId,
            fromStatusId,
            toStatusId: placement.to.statusId,
          };
          statusChangeAlert = {
            leadId: placement.lead.id,
            fromStatusId,
            toStatusId: placement.to.statusId,
            orgId: form.organizationId,
            responsibleId: placement.lead.responsibleId,
          };
          pendingLeadEvents.push({
            leadId: placement.lead.id,
            eventType: "STATUS_CHANGE",
            previousStatusId: fromStatusId,
            newStatusId: placement.to.statusId,
          });
          await trackLeadEvent({
            leadId: placement.lead.id,
            kind: "status_changed",
            metadata: {
              from: fromStatusId,
              to: placement.to.statusId,
              source: "form_submit",
            },
          });
        };

        if (finalizingResponseId) {
          // completedAt: null evita reexecutar a finalização inteira (e
          // duplicar efeitos não-idempotentes — WhatsApp, eventos de
          // jornada, alertas) quando o client reenvia o mesmo
          // finalizingResponseId num retry fantasma (ack do submit
          // anterior se perdeu, mas o servidor já tinha processado).
          const draft = await tx.formResponses.findFirst({
            where: { id: finalizingResponseId, formId: id, completedAt: null },
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

              // Mod 2: garante que o lead do draft termine no tracking/coluna
              // do form ao finalizar (move de coluna ou realoca de tracking).
              if (trackingId && statusId) {
                const placement = await placeLeadInFormTarget(
                  tx,
                  draftLead.id,
                  trackingId,
                  statusId,
                );
                if (placement) await collectPlacementSideEffects(placement);
              }
            }
          }
        } else if (trackingId && statusId) {
          // Mod 2: resolve o lead pelo telefone na org inteira e o posiciona no
          // tracking/coluna do form — realocando o existente ou criando um novo.
          const placement = await resolveAndPlaceLeadForForm(tx, {
            organizationId: form.organizationId,
            phone: userPhone,
            formTrackingId: trackingId,
            formStatusId: statusId,
            leadData: { name: userName, email: userEmail, phone: userPhone },
            trackingParams,
          });

          leadId = placement.lead.id;
          outLeadId = placement.lead.id;
          outLeadName = placement.lead.name;
          outLeadEmail = placement.lead.email;
          outLeadPhone = placement.lead.phone;
          outLeadPublicToken = placement.lead.publicToken;

          // Tags das respostas (radio/checkbox com tagId) — idempotente.
          if (tagsFind.length > 0) {
            await tx.leadTag.createMany({
              data: tagsFind.map((tag) => ({
                leadId: placement.lead.id,
                tagId: tag.id,
              })),
              skipDuplicates: true,
            });
          }

          await trackLeadEvent({
            leadId: placement.lead.id,
            kind: "form_submit",
            metadata: { formId: id, returning: placement.outcome !== "created" },
          });

          if (placement.outcome === "created") {
            createdLeadForBoard = {
              leadId: placement.lead.id,
              trackingId,
              statusId,
            };
            if (shouldLogUtmLanding(trackingParams)) {
              await trackLeadEvent({
                leadId: placement.lead.id,
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
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${trackingId}&leadId=${placement.lead.id}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ trackingId }),
              },
            );
          } else {
            await collectPlacementSideEffects(placement);
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
            data: {
              jsonResponse: response,
              label: autoLabel,
              completedAt: new Date(),
            },
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
                  completedAt: new Date(),
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

        // Captura o id da resposta desta submissão (draft finalizado usa o
        // próprio id; nova submissão usa a linha recém-criada) + seu lead.
        submittedResponseId =
          finalizingResponseId ?? updatedForm.formSubmissions?.[0]?.id ?? null;
        submittedResponseLeadId = leadId;

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

        return { formMeta: form, createdLeadForBoard };
      });

      // Dispara Pusher/journey FORA da tx — recordLeadEvent chama Pusher e
      // não pode rodar dentro do $transaction (causa timeout).
      if (pendingLeadEvents.length > 0) {
        await Promise.all(pendingLeadEvents.map((e) => recordLeadEvent(e)));
      }

      // Realtime do board: lead novo entrou no tracking → board refetcha a
      // coluna e o card aparece ao vivo. Best-effort (helper isola erro).
      if (createdLeadForBoard) {
        await publishLeadCreated({ ...createdLeadForBoard, source: "form" });
      }

      // Mod 2: lead movido/realocado pro tracking/coluna do form → atualiza o
      // board (origem + destino) e dispara o alerta de mudança de status.
      // Const locais: TS não estreita `let` atribuído dentro do closure da tx.
      // `as` força o tipo da expressão pra a união: o TS narrowa o `let`
      // atribuído dentro do closure da tx para `null` no CFA (não rastreia a
      // atribuição), o que colapsaria o guard para `never` sem o cast.
      const movedForBoard = movedLeadForBoard as MovedLeadForBoard | null;
      if (movedForBoard) {
        await publishLeadMoved({
          leadId: movedForBoard.leadId,
          fromTrackingId: movedForBoard.fromTrackingId,
          toTrackingId: movedForBoard.toTrackingId,
          fromStatusId: movedForBoard.fromStatusId,
          toStatusId: movedForBoard.toStatusId,
          movedAt: new Date().toISOString(),
        });
      }
      const alertToPublish = statusChangeAlert as StatusChangeAlert | null;
      if (alertToPublish) {
        await eventBus.publish("lead.status_changed", alertToPublish);
      }

      // Propaga labels → Lead.description (textareas card + observações).
      // pendingLeadEvents.leadId é o lead que recebeu o FORM_SUBMITTED.
      const submittedLeadId = pendingLeadEvents[0]?.leadId ?? null;
      syncFormLabelsToLeadDescription(prisma, submittedLeadId).catch(() => {});

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

      // Alert engine — form preenchido (event-based).
      // Coleta dados da última submissão pro payload tipado.
      try {
        const submitMeta = await prisma.form.findUnique({
          where: { id },
          select: {
            organizationId: true,
            formSubmissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, leadId: true },
            },
          },
        });
        const lastSub = submitMeta?.formSubmissions?.[0];
        if (submitMeta && lastSub) {
          await eventBus.publish("form.submitted", {
            formId: id,
            responseId: lastSub.id,
            leadId: lastSub.leadId ?? null,
            orgId: submitMeta.organizationId,
          });
        }
      } catch (err) {
        console.error("[form/submit] eventBus publish falhou:", err);
      }

      // Gera a Action configurada a partir da resposta (síncrono, como o lead).
      // Isolado: uma falha aqui nunca derruba o submit já commitado. Usa a
      // resposta DESTA submissão (capturada na tx) e os dados do form já
      // carregados — sem re-buscar "a mais recente por createdAt".
      // Cast força a união: o TS narrowa `let` atribuído no closure da tx.
      const responseIdForActions = submittedResponseId as string | null;
      const responseLeadForActions = submittedResponseLeadId as string | null;
      try {
        const actionsConfig = formMeta.settings?.generateActionsConfig;
        if (responseIdForActions && actionsConfig) {
          await generateActionsForResponse({
            form: {
              id,
              userId: formMeta.userId,
              organizationId: formMeta.organizationId,
              name: formMeta.name,
              jsonBlock: formMeta.jsonBlock,
              trackingId: formMeta.settings?.trackingId ?? null,
            },
            formResponse: {
              id: responseIdForActions,
              jsonResponse: response,
              leadId: responseLeadForActions,
            },
            config: actionsConfig,
          });
        }
      } catch (genErr) {
        console.error("[form/submit] geração de actions falhou:", genErr);
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
