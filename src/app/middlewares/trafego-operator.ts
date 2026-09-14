import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { base } from "./base";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";

/**
 * Operador do trafeGO: admin do sistema **ou** participante do tracking de
 * operação.
 *
 * A escolha é do dono (spec 0009 D-7): quem trabalha no kanban confirma o PIX
 * sem precisar ser admin, porque é essa pessoa que está olhando o comprovante
 * no card. A auditoria compensa — toda confirmação grava quem confirmou, o
 * valor recebido e a observação, e passa pelo log de atividade.
 */
export const requireTrafegoOperatorMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const sessionData = await auth.api.getSession({ headers: context.headers });
    if (!sessionData?.session || !sessionData.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionData.user.id },
      select: { id: true, name: true, email: true, isSystemAdmin: true },
    });
    if (!user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    if (user.isSystemAdmin) {
      return next({
        context: { session: sessionData.session, operator: { ...user, isAdmin: true } },
      });
    }

    const settings = await loadTrafegoSettings();
    if (!settings.operationsTrackingId) {
      throw errors.FORBIDDEN({
        message: "A operação do trafeGO ainda não foi configurada.",
      });
    }

    const participant = await prisma.trackingParticipant.findFirst({
      where: { trackingId: settings.operationsTrackingId, userId: user.id },
      select: { id: true },
    });
    if (!participant) {
      throw errors.FORBIDDEN({
        message: "Só quem participa do tracking do trafeGO pode fazer isso.",
      });
    }

    return next({
      context: { session: sessionData.session, operator: { ...user, isAdmin: false } },
    });
  },
);
