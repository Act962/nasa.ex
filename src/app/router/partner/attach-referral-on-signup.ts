import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  attachReferralFromLink,
  recalcPartnerTier,
  recalcReferralActivity,
} from "@/features/partner/lib/partner-service";

/**
 * Chamada após criar uma org no signup com cookie `nasa_ref` presente.
 * Idempotente — chama várias vezes sem efeito se já existir vínculo.
 */
export const attachReferralOnSignup = base
  .route({
    method: "POST",
    summary: "Partner — Atribui referral à org recém-criada",
    tags: ["Partner"],
  })
  .input(
    z.object({
      organizationId: z.string(),
      linkCode: z.string().min(1).max(32),
    }),
  )
  .output(
    z.object({
      attached: z.boolean(),
      referralId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const session = await auth.api.getSession({ headers: context.headers });
    if (!session?.user) {
      throw errors.UNAUTHORIZED({ message: "Não autorizado" });
    }

    // Verifica se a org pertence ao usuário (segurança)
    const member = await prisma.member.findFirst({
      where: {
        organizationId: input.organizationId,
        userId: session.user.id,
      },
    });
    if (!member) {
      throw errors.FORBIDDEN({ message: "Org não pertence ao usuário" });
    }

    const referral = await attachReferralFromLink({
      linkCode: input.linkCode,
      newOrganizationId: input.organizationId,
    });

    if (!referral) return { attached: false, referralId: null };

    // Recalcula atividade da nova referral + tier do parceiro
    await recalcReferralActivity(referral.id);
    const partnerOfReferrer = await prisma.partner.findUnique({
      where: { userId: referral.partnerUserId },
    });
    if (partnerOfReferrer) {
      await recalcPartnerTier(partnerOfReferrer.id);
    }

    return { attached: true, referralId: referral.id };
  });

/**
 * Consume `nasa_ref` cookie (httpOnly) e attach referral à org recém-criada.
 * O cliente não precisa conhecer o linkCode — tudo server-side.
 *
 * Idempotente: se a org já tem referral, não faz nada.
 * Se cookie ausente ou inválido: retorna { attached: false }.
 */
export const consumeReferralFromCookie = base
  .route({
    method: "POST",
    summary: "Partner — Consome cookie nasa_ref e atribui referral",
    tags: ["Partner"],
  })
  .input(z.object({ organizationId: z.string() }))
  .output(
    z.object({
      attached: z.boolean(),
      referralId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const session = await auth.api.getSession({ headers: context.headers });
    if (!session?.user) throw errors.UNAUTHORIZED({ message: "Não autorizado" });

    // Verifica que a org pertence ao usuário
    const member = await prisma.member.findFirst({
      where: { organizationId: input.organizationId, userId: session.user.id },
    });
    if (!member) {
      throw errors.FORBIDDEN({ message: "Org não pertence ao usuário" });
    }

    // Lê cookie nasa_ref do header
    const cookieHeader = context.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)nasa_ref=([^;]+)/);
    if (!match) return { attached: false, referralId: null };
    const linkCode = decodeURIComponent(match[1]).slice(0, 32);
    if (!linkCode) return { attached: false, referralId: null };

    const referral = await attachReferralFromLink({
      linkCode,
      newOrganizationId: input.organizationId,
    });
    if (!referral) return { attached: false, referralId: null };

    await recalcReferralActivity(referral.id);
    const partnerOfReferrer = await prisma.partner.findUnique({
      where: { userId: referral.partnerUserId },
    });
    if (partnerOfReferrer) await recalcPartnerTier(partnerOfReferrer.id);

    return { attached: true, referralId: referral.id };
  });

/**
 * Loga visita anônima ao link. Endpoint público — sem auth.
 * Disparado pelo cliente via fetch interno após o middleware setar o cookie.
 */
export const logLinkVisit = base
  .route({
    method: "POST",
    summary: "Partner — Log de visita ao link de indicação",
    tags: ["Partner"],
  })
  .input(z.object({ linkCode: z.string().min(1).max(32) }))
  .output(z.object({ logged: z.boolean() }))
  .handler(async ({ input, context }) => {
    const link = await prisma.partnerReferralLink.findUnique({
      where: { code: input.linkCode },
    });
    if (!link) return { logged: false };

    const ip =
      context.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      context.headers.get("x-real-ip") ??
      null;
    const ua = context.headers.get("user-agent") ?? null;

    await prisma.$transaction([
      prisma.partnerLinkVisit.create({
        data: {
          linkId: link.id,
          ip,
          userAgent: ua,
        },
      }),
      prisma.partnerReferralLink.update({
        where: { id: link.id },
        data: { visits: { increment: 1 } },
      }),
    ]);

    return { logged: true };
  });
