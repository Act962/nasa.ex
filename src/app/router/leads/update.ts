import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { LEAD_ADDRESS_FIELDS, updateLeadRecord } from "@/features/leads/server/lead-commands";
import {
  areTagsInOrganization,
  isStatusInTracking,
  isTrackingInOrganization,
  isTrackingParticipant,
} from "@/features/leads/lib/tracking-participant-guard";

type LeadAddressField = (typeof LEAD_ADDRESS_FIELDS)[number];

const LEAD_ADDRESS_INPUT = Object.fromEntries(
  LEAD_ADDRESS_FIELDS.map((field) => [field, z.string().max(200).nullable().optional()]),
) as Record<LeadAddressField, z.ZodOptional<z.ZodNullable<z.ZodString>>>;

// 🟦 UPDATE
export const updateLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update an existing lead",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        // Apelido informal — pode ser limpo passando string vazia ou null.
        nickname: z.string().nullable().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        description: z.string().optional(),
        statusId: z.string().optional(),
        responsibleId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        isConversation: z.boolean().optional().default(false),
        // Sem padrão: só quem manda `active` mexe na IA (spec 0113, RF-1).
        active: z.boolean().optional(),
        statusFlow: z.enum(["WAITING", "ACTIVE", "FINISHED"]).optional(),
        amount: z.number().optional(),
        trackingId: z.string().optional(),
        orgProjectId: z.string().nullable().optional(),
        temperature: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]).optional(),
        // Endereço (spec 0034): string vazia ou null limpa o campo.
        ...LEAD_ADDRESS_INPUT,
      })
      .refine(
        (v) =>
          v.name !== undefined ||
          v.nickname !== undefined ||
          v.phone !== undefined ||
          v.email !== undefined ||
          v.description !== undefined ||
          v.statusId !== undefined ||
          v.responsibleId !== undefined ||
          v.trackingId !== undefined ||
          v.tagIds !== undefined ||
          v.active !== undefined ||
          v.statusFlow !== undefined ||
          v.amount !== undefined ||
          v.orgProjectId !== undefined ||
          v.temperature !== undefined ||
          LEAD_ADDRESS_FIELDS.some((field) => v[field] !== undefined),
        {
          message: "No fields to update",
          path: ["id"],
        },
      ),
  )
  .handler(async ({ input, errors, context }) => {
    const leadScope = await prisma.lead.findUnique({
      where: { id: input.id },
      select: { trackingId: true, tracking: { select: { organizationId: true } } },
    });
    if (!leadScope) throw errors.NOT_FOUND;
    const leadOrganizationId = leadScope.tracking.organizationId;
    const destinationTrackingId = input.trackingId ?? leadScope.trackingId;
    const isAccessAllowed =
      (await isTrackingParticipant(leadScope.trackingId, context.user.id)) &&
      (destinationTrackingId === leadScope.trackingId ||
        (await isTrackingInOrganization(destinationTrackingId, leadOrganizationId))) &&
      (!input.statusId || (await isStatusInTracking(input.statusId, destinationTrackingId))) &&
      (!input.tagIds || (await areTagsInOrganization(input.tagIds, leadOrganizationId)));
    if (!isAccessAllowed) throw errors.NOT_FOUND;

    try {
      const { isConversation: _isConversation, ...leadInput } = input;
      const result = await updateLeadRecord({ actor: {
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        image: (context.user as { image?: string | null }).image,
      }, input: leadInput });
      return result;
    } catch (err) {
      // Sem isso o NOT_FOUND do comando casaria o regex de "not found" e viraria BAD_REQUEST.
      if (err instanceof ORPCError) throw err;
      // Loga COM contexto pra investigação posterior. O erro genérico
      // "INTERNAL_SERVER_ERROR" no client escondia a causa real (foreign
      // key, coluna inexistente em drift de DB, status pertencente a
      // outro tracking etc). Repropaga mensagem específica quando seguro.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[leads/update] failed", {
        leadId: input.id,
        trackingId: input.trackingId,
        statusId: input.statusId,
        error: msg,
      });
      // Erros conhecidos de validação/integridade — devolve mensagem
      // amigável pro user em vez de "Algo deu errado".
      if (/foreign key|constraint|not found|does not exist/i.test(msg)) {
        throw errors.BAD_REQUEST({
          message: `Não foi possível mover o lead: ${msg}`,
        });
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
