import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { auth } from "@/lib/auth";
import { getOrCreateReferralLink } from "@/features/partner/lib/partner-service";

/**
 * Endpoint público (apenas autenticado): retorna ou cria o link de
 * indicação do usuário corrente. Não exige Partner ACTIVE — qualquer
 * usuário autenticado tem direito ao próprio link.
 */
export const getMyLink = base
  .route({
    method: "GET",
    summary: "Partner — Meu link de indicação",
    tags: ["Partner"],
  })
  .output(
    z.object({
      code: z.string(),
      url: z.string(),
      visits: z.number(),
      signups: z.number(),
    }),
  )
  .handler(async ({ context, errors }) => {
    const sessionData = await auth.api.getSession({
      headers: context.headers,
    });
    if (!sessionData?.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }
    const link = await getOrCreateReferralLink(sessionData.user.id);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nasa.com.br";
    return {
      code: link.code,
      url: `${baseUrl}/sign-up?ref=${link.code}`,
      visits: link.visits,
      signups: link.signups,
    };
  });
