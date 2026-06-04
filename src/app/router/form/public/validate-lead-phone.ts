import { base } from "@/app/middlewares/base";
import z from "zod";
import { validateLeadWhatsapp } from "@/features/form/lib/validate-lead-whatsapp";

/**
 * Valida — via a instância de WhatsApp do tracking vinculado ao form — se o
 * número informado pelo lead é um WhatsApp válido. Rota PÚBLICA (sem auth):
 * chamada pelo botão "Continuar" do FormSubmitComponent na etapa 1.
 *
 * A checagem real precisa do `apiKey`/`baseUrl` da `WhatsAppInstance` (dados
 * server-side), por isso não pode rodar no client. Toda a lógica de cenários
 * (fail-open) vive em `validateLeadWhatsapp`.
 */
export const validateLeadPhone = base
  .route({
    method: "POST",
    path: "/forms/public/:formId/validate-phone",
    summary: "Valida se o telefone do lead é um WhatsApp válido (público)",
  })
  .input(
    z.object({
      formId: z.string(),
      phone: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const result = await validateLeadWhatsapp(input.formId, input.phone);
    return { result };
  });
