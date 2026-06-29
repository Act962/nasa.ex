import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import z from "zod";
import { searchDomains } from "@/features/pages/lib/domain-provider";

export const searchDomain = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/pages/domain/search",
    summary: "Buscar disponibilidade de domínio via registrador parceiro",
  })
  .input(
    z.object({
      query: z.string().min(2),
      tlds: z.array(z.string()).default([".com", ".com.br", ".io", ".app", ".site"]),
    }),
  )
  .handler(async ({ input, errors }) => {
    try {
      const results = await searchDomains(input.query, input.tlds);
      return { results };
    } catch (e) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: `Erro ao consultar registrador: ${(e as Error).message}`,
      });
    }
  });
