import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { PartnerStatus } from "@/generated/prisma/client";
import { base } from "./base";

/**
 * Middleware oRPC que exige sessão autenticada + Partner ACTIVE.
 *
 * Bloqueia:
 *  - Sem sessão → UNAUTHORIZED
 *  - Sem registro Partner → FORBIDDEN
 *  - Partner.status !== ACTIVE (ELIGIBLE/SUSPENDED) → FORBIDDEN
 *
 * Não checa aceite de termos: as procedures que dependem de aceite (ex.
 * acessos a dados sensíveis das orgs indicadas) chamam o helper extra
 * `assertPartnerAcceptedActiveTerms` quando necessário.
 */
export const requirePartnerMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const sessionData = await auth.api.getSession({
      headers: context.headers,
    });

    if (!sessionData?.session || !sessionData.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isSystemAdmin: true,
      },
    });

    if (!dbUser) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: dbUser.id },
    });

    if (!partner) {
      throw errors.FORBIDDEN({ message: "Você ainda não é um parceiro NASA" });
    }

    if (partner.status === PartnerStatus.SUSPENDED) {
      throw errors.FORBIDDEN({
        message: "Sua conta de parceiro está suspensa. Fale com o suporte.",
      });
    }

    if (partner.status !== PartnerStatus.ACTIVE) {
      throw errors.FORBIDDEN({
        message:
          "Conta de parceiro ainda não ativada — atinja o nível mínimo para liberar o painel.",
      });
    }

    return next({
      context: {
        session: sessionData.session,
        partnerUser: dbUser,
        partner,
      },
    });
  },
);
