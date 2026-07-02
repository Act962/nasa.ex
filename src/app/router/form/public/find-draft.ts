import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Busca a FormResponses mais recente do lead pra esse formId, pelo
 * telefone. Usado pelo fluxo público de "Continuar preenchimento"
 * cross-device:
 *
 *   - Lead começa form no celular, fecha o navegador antes de submeter.
 *   - Depois abre o mesmo form no computador (URL pública).
 *   - Após digitar o telefone na etapa 1, o client chama essa procedure.
 *   - Se a resposta mais recente estiver aberta, o client hidrata os
 *     campos com `jsonResponse`. Se já estiver completa (`completedAt`
 *     preenchido), o client NÃO hidrata — nem daqui, nem do rascunho
 *     local — pra não reviver dados de um formulário já enviado quando o
 *     ack do submit se perdeu (tela travada, conexão caiu).
 *
 * Critérios:
 *   - lead identificado pela combinação (phone + trackingId), igual ao
 *     `submitResponse` e `savePartialResponse`.
 *   - devolve a FormResponses mais recente do lead pra esse form,
 *     ordenada por `createdAt DESC`, independente do status — a
 *     procedure não filtra por `completedAt`; quem decide o que fazer
 *     com isso (hidratar ou bloquear) é o client, com base no campo
 *     `completedAt` do retorno.
 *
 * Privacidade: a procedure é PÚBLICA. Só devolve `jsonResponse` quando o
 * telefone bate exatamente — atua como "chave secreta" do user. Se mudou
 * o número, a resposta não é exposta.
 */
export const findDraftByPhone = base
  .route({
    // POST (não GET) pra evitar logar o telefone em URL/access logs +
    // pra usar via `useMutation` no client (acionado on-click, não
    // on-mount). Procedure ainda é read-only no banco.
    method: "POST",
    path: "/forms/public/:formId/draft",
    summary: "Find an in-progress form draft by phone",
  })
  .input(
    z.object({
      formId: z.string(),
      phone: z.string().trim().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const form = await prisma.form.findUnique({
        where: { id: input.formId, published: true },
        select: {
          id: true,
          settings: { select: { trackingId: true } },
        },
      });
      if (!form) return { response: null };
      const trackingId = form.settings?.trackingId;
      if (!trackingId) return { response: null };

      const lead = await prisma.lead.findUnique({
        where: {
          phone_trackingId: { phone: input.phone, trackingId },
        },
        select: { id: true, name: true, email: true, phone: true },
      });
      if (!lead) return { response: null };

      // Resposta mais recente do lead pra esse form, independente do status.
      // O client decide o que fazer com base em `completedAt`: aberta hidrata,
      // completa bloqueia hidratação (mesmo daqui, mesmo do rascunho local).
      const latestResponse = await prisma.formResponses.findFirst({
        where: { leadId: lead.id, formId: form.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          jsonResponse: true,
        },
      });
      if (!latestResponse) return { response: null };

      return {
        response: {
          responseId: latestResponse.id,
          createdAt: latestResponse.createdAt,
          completedAt: latestResponse.completedAt,
          jsonResponse: latestResponse.jsonResponse,
          lead: {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
          },
        },
      };
    } catch (err) {
      console.error("[form/findDraftByPhone]", err);
      throw errors.INTERNAL_SERVER_ERROR();
    }
  });
