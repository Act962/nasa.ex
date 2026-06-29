import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Busca um draft (FormResponses em preenchimento) existente pelo telefone
 * do lead + formId. Usado pelo fluxo público de "Continuar preenchimento"
 * cross-device:
 *
 *   - Lead começa form no celular, fecha o navegador antes de submeter.
 *   - Depois abre o mesmo form no computador (URL pública).
 *   - Após digitar o telefone na etapa 1, o client chama essa procedure.
 *   - Se encontrar draft em aberto pra esse telefone + formId, devolve
 *     o `responseId` + `jsonResponse` pra hidratar os campos do form.
 *
 * Critérios:
 *   - lead identificado pela combinação (phone + trackingId), igual ao
 *     `submitResponse` e `savePartialResponse`.
 *   - "em aberto" = qualquer FormResponses do lead pra esse form,
 *     ordenado pelo `createdAt DESC` (último draft prevalece). Não
 *     filtramos por estado — o user decide se quer continuar ou começar
 *     de novo (pode editar/limpar campos depois de carregar).
 *
 * Privacidade: a procedure é PÚBLICA. Só devolve `jsonResponse` quando o
 * telefone bate exatamente — atua como "chave secreta" do user. Se mudou
 * o número, o draft não é exposto.
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
      if (!form) return { draft: null };
      const trackingId = form.settings?.trackingId;
      if (!trackingId) return { draft: null };

      const lead = await prisma.lead.findUnique({
        where: {
          phone_trackingId: { phone: input.phone, trackingId },
        },
        select: { id: true, name: true, email: true, phone: true },
      });
      if (!lead) return { draft: null };

      // Último rascunho incompleto do lead pra esse form.
      // completedAt: null garante que só drafts ainda em aberto são retomados
      // — respostas já finalizadas (enviadas via submitResponse) são ignoradas.
      const draft = await prisma.formResponses.findFirst({
        where: { leadId: lead.id, formId: form.id, completedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          jsonResponse: true,
        },
      });
      if (!draft) return { draft: null };

      return {
        draft: {
          responseId: draft.id,
          createdAt: draft.createdAt,
          jsonResponse: draft.jsonResponse,
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
