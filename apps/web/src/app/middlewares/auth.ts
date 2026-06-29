import { auth } from "@/lib/auth";
import { base } from "./base";

export const requiredAuthMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const sessionData = await auth.api.getSession({
      headers: context.headers,
    });

    if (!sessionData?.session || !sessionData.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    return next({
      context: {
        session: sessionData.session,
        user: sessionData.user,
      },
    });
  }
);

/**
 * Opcional: tenta carregar a sessão mas NÃO falha se não houver usuário.
 * Útil para procedures públicas que querem personalizar o resultado
 * quando o usuário está autenticado (ex: excluir templates próprios).
 */
export const optionalAuthMiddleware = base.middleware(
  async ({ context, next }) => {
    const sessionData = await auth.api.getSession({
      headers: context.headers,
    });
    return next({
      context: {
        session: sessionData?.session ?? null,
        user:    sessionData?.user ?? null,
      },
    });
  }
);
