import { base } from "@/app/middlewares/base";
import z from "zod";
import { getAddressByCep } from "@/http/viacep/get-address";
import { ViaCepError } from "@/http/viacep/types";

/**
 * Valida — via ViaCEP — se o CEP informado pelo lead realmente existe. Rota
 * PÚBLICA (sem auth): chamada pelo campo formatado (MaskedField/CEP) do
 * FormSubmitComponent quando a toggle "Validar se o CEP existe" está ligada.
 *
 * Fail-open: indisponibilidade do ViaCEP (timeout/rede) não pode travar a
 * captação de leads → `skipped`. Só CEP comprovadamente inexistente (404) ou
 * malformado (400) bloqueia com `invalid`.
 */
export const validateCep = base
  .route({
    method: "POST",
    path: "/forms/public/validate-cep",
    summary: "Valida se o CEP do lead existe no ViaCEP (público)",
  })
  .input(
    z.object({
      cep: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    try {
      await getAddressByCep(input.cep);
      return { status: "valid" as const };
    } catch (error) {
      if (error instanceof ViaCepError && (error.status === 404 || error.status === 400)) {
        return { status: "invalid" as const };
      }
      return { status: "skipped" as const };
    }
  });
