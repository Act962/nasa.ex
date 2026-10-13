import z from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { isCompanyAiManager } from "@/features/ia/server/load-ai-usage";
import { applyAttendanceTemplate } from "@/features/tracking-chat-ai/lib/attendance-setup/apply-attendance-template";
import prisma from "@/lib/prisma";

// Cria o modelo de atendimento por menu num funil (spec 0097). Só dono e admin da empresa do funil.
export const createAttendanceTemplate = base
  .use(requiredAuthMiddleware)
  .input(z.object({ trackingId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
      select: { id: true, organizationId: true, organization: { select: { name: true } } },
    });
    // Funil de outra empresa responde igual a funil que não existe.
    if (!tracking || !(await prisma.member.findFirst({ where: { organizationId: tracking.organizationId, userId: context.user.id }, select: { id: true } }))) {
      throw errors.NOT_FOUND({ message: "Funil não encontrado" });
    }
    if (!(await isCompanyAiManager(tracking.organizationId, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Só o dono ou um administrador da empresa cria o modelo de atendimento." });
    }
    return prisma.$transaction((tx) =>
      applyAttendanceTemplate(tx, {
        organizationId: tracking.organizationId,
        trackingId: tracking.id,
        userId: context.user.id,
        companyName: tracking.organization.name,
      }),
    );
  });
