import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";
import { recordLeadEvent } from "@/features/leads/lib/history";

/**
 * Versão pública de update — chamada pelo cliente final na rota
 * `/lead/<token>/formulario/<responseId>` quando ele assina blocos
 * `SignatureClient`. Auth via publicToken do lead.
 *
 * SEGURANÇA: a procedure só permite ALTERAR campos cujo bloco no jsonBlock
 * do form seja do tipo `SignatureClient`. Outros campos do `responseUpdates`
 * são silenciosamente IGNORADOS — defesa contra alterações não-autorizadas
 * caso o cliente edite o JS no cliente.
 */
export const updateClientSignatures = base
  .route({
    method: "PATCH",
    path: "/forms/public-response/:responseId/signatures",
    summary: "Public client signs SignatureClient blocks of a form response",
  })
  .input(
    z.object({
      token: z.string().min(10),
      responseId: z.string(),
      // Mapa { blockId: { value, meta } } com o que o cliente quer atualizar.
      signatures: z.record(
        z.string(),
        z.object({
          value: z.string(),
          meta: z
            .object({
              dataUrl: z.string().optional(),
              signedAt: z.string().optional(),
            })
            .passthrough()
            .optional(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const response = await prisma.formResponses.findFirst({
        where: {
          id: input.responseId,
          lead: { publicToken: input.token },
        },
        select: {
          id: true,
          leadId: true,
          jsonResponse: true,
          form: { select: { id: true, jsonBlock: true } },
        },
      });

      if (!response) {
        throw errors.NOT_FOUND({ message: "Resposta não encontrada" });
      }

      // Coleta IDs dos blocos SignatureClient a partir do jsonBlock do form.
      // Só esses podem ser alterados nesta rota.
      const allowedBlockIds = collectSignatureClientIds(response.form.jsonBlock);
      if (allowedBlockIds.size === 0) {
        return { message: "Nenhuma assinatura de cliente disponível" };
      }

      // Carrega o jsonResponse atual e mescla apenas os campos permitidos.
      let parsed: Record<string, unknown> = {};
      try {
        parsed =
          typeof response.jsonResponse === "string"
            ? JSON.parse(response.jsonResponse)
            : (response.jsonResponse as Record<string, unknown>);
      } catch {
        parsed = {};
      }

      let touched = 0;
      for (const [blockId, value] of Object.entries(input.signatures)) {
        if (!allowedBlockIds.has(blockId)) continue; // não autorizado → ignora
        if (!value || typeof value.value !== "string") continue;
        parsed[blockId] = {
          value: value.value,
          meta: { ...(value.meta ?? {}), signedAt: new Date().toISOString() },
        };
        touched++;
      }

      if (touched === 0) {
        return { message: "Nada pra atualizar" };
      }

      await prisma.formResponses.update({
        where: { id: response.id },
        data: { jsonResponse: JSON.stringify(parsed) },
      });

      // Registra no histórico do lead (sem userId — quem assinou foi o
      // próprio cliente externo via link público).
      if (response.leadId) {
        await recordLeadEvent({
          leadId: response.leadId,
          eventType: "FORM_SUBMITTED",
          metadata: {
            formResponseId: response.id,
            formId: response.form.id,
            clientSigned: true,
            signedBlockIds: Object.keys(input.signatures).filter((id) =>
              allowedBlockIds.has(id),
            ),
          },
        });
      }

      return { message: "Assinatura registrada", touched };
    } catch (error: any) {
      if (error?.code === "NOT_FOUND") throw error;
      console.error("[form/updateClientSignatures]", error);
      throw errors.INTERNAL_SERVER_ERROR({
        message: error?.message || "Erro interno",
      });
    }
  });

/**
 * Walka recursivamente o jsonBlock do form e devolve os IDs dos blocos que
 * são `SignatureClient` (permitidos pra atualização pública).
 */
function collectSignatureClientIds(jsonBlock: unknown): Set<string> {
  const ids = new Set<string>();
  let parsed: unknown = jsonBlock;
  if (typeof jsonBlock === "string") {
    try {
      parsed = JSON.parse(jsonBlock);
    } catch {
      return ids;
    }
  }
  function visit(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as {
      id?: string;
      blockType?: string;
      childblocks?: unknown[];
    };
    if (n.blockType === "SignatureClient" && typeof n.id === "string") {
      ids.add(n.id);
    }
    if (Array.isArray(n.childblocks)) {
      for (const c of n.childblocks) visit(c);
    }
  }
  if (Array.isArray(parsed)) {
    for (const node of parsed) visit(node);
  }
  return ids;
}
