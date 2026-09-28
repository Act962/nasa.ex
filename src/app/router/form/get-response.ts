import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import {
  checkLeadTrackingParticipant,
  NOT_TRACKING_PARTICIPANT_MESSAGE,
} from "@/features/leads/lib/tracking-participant-guard";
import {
  checkFormResponseEditable,
  resolveEditPolicy,
  EDIT_BLOCKED_MESSAGE,
} from "@/features/form/lib/can-edit-response";

/**
 * Busca uma `FormResponses` específica por ID, retornando junto:
 *  - o form completo (jsonBlock + settings) — pra renderizar o form na UI
 *    de "Continuar preenchimento" (`/formulario/[slug]/[responseId]`).
 *  - os dados do lead vinculado (status atual + responsável + cor) pra
 *    exibir contexto na barra superior da página.
 *
 * Auth: usuário precisa estar logado e na mesma organização do form.
 */
export const getResponseById = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/forms/responses/:id",
    summary: "Fetch a single form response by ID (for resume-fill flow)",
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const { id } = input;
      const userId = context.user.id;

      // Carrega a resposta sem filtrar por org ativa — depois verificamos
      // que o usuário é membro da org do form. Isso evita 404 falsos quando
      // o `activeOrganizationId` da sessão está null/desatualizado.
      const response = await prisma.formResponses.findFirst({
        where: { id },
        select: {
          id: true,
          createdAt: true,
          jsonResponse: true,
          authorKind: true,
          createdById: true,
          createdBy: {
            select: { id: true, name: true, image: true },
          },
          form: {
            select: {
              id: true,
              name: true,
              jsonBlock: true,
              published: true,
              organizationId: true,
              settings: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              publicToken: true,
              status: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
              responsible: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              tracking: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!response) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      // Verifica que o user é membro da org do form (defesa em profundidade).
      const member = await prisma.member.findFirst({
        where: { organizationId: response.form.organizationId, userId },
        select: { id: true },
      });
      if (!member) {
        throw errors.UNAUTHORIZED({
          message: "Você não tem acesso a esta resposta",
        });
      }

      // Regra de NEGÓCIO: só participantes do tracking ATUAL do lead
      // podem mexer no formulário. Se o lead foi movido pra um tracking
      // do qual o user não participa, bloqueia com mensagem específica.
      //
      // Este é o gate de VISUALIZAÇÃO e continua idêntico ao de antes da spec
      // 0005 — a política de edição não afrouxa nem endurece quem abre a
      // resposta (CB-15).
      if (response.lead?.id) {
        const { ok } = await checkLeadTrackingParticipant(
          response.lead.id,
          userId,
        );
        if (!ok) {
          throw errors.FORBIDDEN({
            message: NOT_TRACKING_PARTICIPANT_MESSAGE,
          });
        }
      }

      // Quem chegou aqui PODE ver. `canEdit` decide se os campos vêm
      // desabilitados — o cliente nunca re-deriva a regra (RF-12).
      const verdict = await checkFormResponseEditable(
        {
          authorKind: response.authorKind,
          createdById: response.createdById,
          leadTrackingId: response.lead?.tracking?.id ?? null,
        },
        resolveEditPolicy(response.form.settings),
        userId,
        response.form.organizationId,
      );

      return {
        response,
        canEdit: verdict.canEdit,
        editBlockedReason: verdict.reason
          ? EDIT_BLOCKED_MESSAGE[verdict.reason]
          : null,
        createdBy: response.createdBy ?? null,
      };
    } catch (error: any) {
      console.error("[form/getResponseById]", error);
      if (error?.code === "NOT_FOUND" || error?.code === "BAD_REQUEST") {
        throw error;
      }
      throw errors.INTERNAL_SERVER_ERROR({
        message: error?.message || "Erro interno",
      });
    }
  });
