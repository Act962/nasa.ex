import prisma from "@/lib/prisma";
import { base } from "./base";

/**
 * Middleware de barramento — bloqueia procedures pagas quando a
 * organização está SUSPENSA (saldo zerado por mais de 15 dias).
 *
 * Diferente do grace period (em que só o Chat AI fica bloqueado), a
 * suspensão é um "kill switch" total: TODA procedure que aplica esse
 * middleware retorna `FORBIDDEN { code: "STARS_SUSPENDED" }`.
 *
 * Frontend mostra modal bloqueante com CTA de top-up via Stripe.
 * Recarregar zera `starsSuspendedAt` (via cron `stars-grace-period-monitor`
 * ou manualmente em `addStars`/`creditStars` extendido).
 *
 * Aplicar nos handlers de cobrança novos + nos IAs já cobrando que
 * representam custo direto (LLM, OCR, Whisper, Resend, uazapi).
 */
export const requireStarsMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    // Depende de `requireOrgMiddleware` já ter rodado e populado context.org.
    const orgId = (context as { org?: { id: string } }).org?.id;
    if (!orgId) {
      // Sem org no contexto — provavelmente endpoint público.
      return next();
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { starsSuspendedAt: true },
    });

    if (org?.starsSuspendedAt) {
      throw errors.FORBIDDEN({
        message:
          "Conta suspensa por falta de STARs. Recarregue pra reativar.",
        data: {
          code: "STARS_SUSPENDED",
          suspendedAt: org.starsSuspendedAt.toISOString(),
        },
      });
    }

    return next();
  },
);
