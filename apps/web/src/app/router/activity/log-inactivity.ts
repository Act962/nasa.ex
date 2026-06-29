import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Registra uma janela de inatividade do usuário (aba em segundo plano).
 *
 * Disparado pelo HeartbeatProvider quando `document.visibilitychange` retorna
 * a aba pra estado visível, se o tempo escondido foi >= 30 s.
 *
 * Reusa `SystemActivityLog` com `action="tab.hidden"` como discriminador e
 * `durationMs` (já existente no schema) como duração da janela. Sem nova coluna.
 */
export const logInactivity = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      // mínimo 30 s (threshold do client) e máximo 24 h pra evitar lixo
      durationMs: z.number().int().min(30_000).max(86_400_000),
    }),
  )
  .handler(async ({ input, context }) => {
    const { user, org } = context;
    await prisma.systemActivityLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: (user as any).image ?? null,
        appSlug: "system",
        action: "tab.hidden",
        actionLabel: "Aba em segundo plano",
        durationMs: input.durationMs,
      },
    });
    return { ok: true };
  });
