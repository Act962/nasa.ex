import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { buildCrossLoginToken } from "@/features/sync/lib/cross-login-token";

function getNerpBaseUrl(): string {
  const url = process.env.NERP_SYNC_BASE_URL ?? process.env.NERP_BASE_URL;
  if (!url) {
    throw new Error("Missing env NERP_SYNC_BASE_URL (ou NERP_BASE_URL).");
  }
  return url.replace(/\/$/, "");
}

/**
 * Admin — gera um link de acesso ao NERP logado COMO o usuário informado.
 *
 * Usa o token cross-app (HMAC `SYNC_SHARED_SECRET`, TTL 60s). O NERP verifica e
 * cria a sessão better-auth. O frontend abre a URL numa nova aba (navegação
 * top-level), pra o cookie de sessão colar no domínio do NERP.
 */
export const nerpLoginAs = base
  .use(requireAdminMiddleware)
  .route({
    method: "POST",
    summary: "Admin — Gera link de login no NERP como usuário",
    tags: ["Admin"],
  })
  .input(z.object({ userId: z.string() }))
  .output(z.object({ url: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true },
    });
    if (!target) throw errors.NOT_FOUND;

    const token = buildCrossLoginToken(target.id);
    const url = `${getNerpBaseUrl()}/api/auth/cross-login?token=${encodeURIComponent(token)}`;

    // Auditoria (best-effort). SystemActivityLog exige organizationId, então
    // registramos sob a 1ª org do usuário alvo, se houver; senão, só console.
    const member = await prisma.member.findFirst({
      where: { userId: target.id },
      select: { organizationId: true },
    });
    if (member) {
      await prisma.systemActivityLog
        .create({
          data: {
            organizationId: member.organizationId,
            userId: context.adminUser.id,
            userName: context.adminUser.name,
            userEmail: context.adminUser.email,
            appSlug: "admin",
            action: "admin.nerp_login_as",
            actionLabel: `Gerou acesso ao NERP como ${target.name}`,
            resource: "user",
            resourceId: target.id,
            metadata: { targetEmail: target.email },
          },
        })
        .catch((e) =>
          console.error("[admin.nerpLoginAs] audit log failed:", e),
        );
    } else {
      console.warn(
        `[admin.nerpLoginAs] admin=${context.adminUser.id} -> nerp as user=${target.id} (sem org, sem audit log)`,
      );
    }

    return { url };
  });
