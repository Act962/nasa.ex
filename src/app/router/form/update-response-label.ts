import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { deriveResponseLabel } from "@/features/form/lib/derive-response-label";
import {
  checkFormResponseEditable,
  resolveEditPolicy,
  EDIT_BLOCKED_MESSAGE,
} from "@/features/form/lib/can-edit-response";

/**
 * Atualiza manualmente o `label` (título customizado) de uma `FormResponses`.
 *
 * - String não-vazia → grava no banco e seta `labelManuallyEdited = true`.
 *   Saves seguintes do `jsonResponse` NÃO sobrescrevem mais (manual prevalece).
 * - String vazia / null → reseta o override: re-deriva automaticamente do bloco
 *   marcado `useAsResponseLabel` e marca `labelManuallyEdited = false`.
 *
 * Permissão: tracking-participant guard (mesma checagem de `updateResponse`).
 * Limite: 80 caracteres (truncado server-side).
 */
const MAX_LABEL_LENGTH = 80;

export const updateResponseLabel = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/forms/responses/:id/label",
    summary: "Update the custom label (title) of a form response",
  })
  .input(
    z.object({
      id: z.string(),
      label: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const userId = context.user.id;

      const existing = await prisma.formResponses.findFirst({
        where: { id: input.id },
        select: {
          id: true,
          leadId: true,
          formId: true,
          jsonResponse: true,
          authorKind: true,
          createdById: true,
          lead: { select: { trackingId: true } },
          form: {
            select: {
              organizationId: true,
              jsonBlock: true,
              settings: { select: { responseEditPolicy: true } },
            },
          },
        },
      });
      if (!existing) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      // Mesmo guard de `updateResponse` — o título é conteúdo da resposta e
      // identifica a O.S.; liberá-lo contornaria o bloqueio pela porta lateral
      // (spec 0005, D-5).
      const verdict = await checkFormResponseEditable(
        {
          authorKind: existing.authorKind,
          createdById: existing.createdById,
          leadTrackingId: existing.lead?.trackingId ?? null,
        },
        resolveEditPolicy(existing.form.settings),
        userId,
        existing.form.organizationId,
      );
      if (!verdict.canEdit) {
        const message = EDIT_BLOCKED_MESSAGE[verdict.reason!];
        console.warn("[form/updateResponseLabel] edição negada", {
          userId,
          responseId: existing.id,
          authorKind: existing.authorKind,
          policy: resolveEditPolicy(existing.form.settings),
          reason: verdict.reason,
        });
        if (verdict.reason === "not_org_member") {
          throw errors.UNAUTHORIZED({ message });
        }
        throw errors.FORBIDDEN({ message });
      }

      const trimmed = (input.label ?? "").trim();

      let nextLabel: string | null;
      let manuallyEdited: boolean;
      if (trimmed.length === 0) {
        // Reset → re-deriva e marca como NÃO editado manualmente.
        nextLabel = deriveResponseLabel({
          jsonBlock: existing.form.jsonBlock,
          jsonResponse: existing.jsonResponse,
        });
        manuallyEdited = false;
      } else {
        nextLabel = trimmed.slice(0, MAX_LABEL_LENGTH);
        manuallyEdited = true;
      }

      const updated = await prisma.formResponses.update({
        where: { id: existing.id },
        data: {
          label: nextLabel,
          labelManuallyEdited: manuallyEdited,
        },
        select: {
          id: true,
          label: true,
          labelManuallyEdited: true,
        },
      });

      return {
        message: "Título atualizado",
        response: updated,
      };
    } catch (err: any) {
      if (
        err?.code === "NOT_FOUND" ||
        err?.code === "BAD_REQUEST" ||
        err?.code === "UNAUTHORIZED" ||
        err?.code === "FORBIDDEN"
      ) {
        throw err;
      }
      console.error("[form/updateResponseLabel]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
