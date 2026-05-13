import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  checkRateLimit,
  ONE_DAY_MS,
} from "@/features/public-calendar/utils/rate-limit";

const REPORT_SCORE_THRESHOLD = Number(
  process.env.CALENDAR_REPORT_SCORE_THRESHOLD ?? 10,
);

/**
 * Denúncia leve de evento público — abaixo de "reivindicar" em peso.
 * Qualquer pessoa (auth ou não) pode denunciar por motivos diversos
 * (uso indevido de marca, evento falso, conteúdo ofensivo, duplicado).
 *
 * Reports acumulam `weight` (1 padrão, 5 se reporter é de org verificada).
 * Quando `Action.reportScore` atinge threshold (env-configurable),
 * evento ganha `isDisputed=true` automaticamente — admin precisa
 * decidir.
 */
export const submitReport = base
  .use(optionalAuthMiddleware)
  .input(
    z.object({
      actionId: z.string(),
      reason: z.enum(["BRAND_MISUSE", "FAKE", "OFFENSIVE", "DUPLICATE", "OTHER"]),
      detail: z.string().trim().max(2000).optional(),
      email: z.string().trim().email().max(200).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const ipKey = (context.headers?.get?.("x-forwarded-for") || "anon")
      .split(",")[0]
      .trim();
    const emailKey = input.email?.toLowerCase() ?? context.user?.email ?? "anon";
    const rateKey = `report:${ipKey}:${emailKey}`;
    const rate = checkRateLimit(rateKey, 5, ONE_DAY_MS);
    if (!rate.allowed) {
      throw errors.TOO_MANY_REQUESTS({
        message: "Muitas denúncias em pouco tempo. Tente em algumas horas.",
      });
    }

    const action = await prisma.action.findUnique({
      where: { id: input.actionId, isPublic: true },
      select: { id: true, title: true, reportScore: true },
    });
    if (!action) {
      throw errors.NOT_FOUND({ message: "Evento não encontrado." });
    }

    // Calcula peso: 5 se reporter é admin OU se email bate com membro de
    // org verificada; senão 1.
    let weight = 1;
    if (context.user?.isSystemAdmin) {
      weight = 5;
    } else if (context.user?.id) {
      const memberInVerified = await prisma.member.findFirst({
        where: {
          userId: context.user.id,
          organization: { isVerified: true },
        },
        select: { id: true },
      });
      if (memberInVerified) weight = 5;
    }

    const newScore = action.reportScore + weight;
    const shouldFlag =
      newScore >= REPORT_SCORE_THRESHOLD && action.reportScore < REPORT_SCORE_THRESHOLD;

    await prisma.$transaction([
      prisma.eventReport.create({
        data: {
          actionId: action.id,
          reporterUserId: context.user?.id ?? null,
          reporterEmail: input.email?.toLowerCase() ?? context.user?.email ?? null,
          reporterIp: ipKey === "anon" ? null : ipKey,
          reason: input.reason,
          detail: input.detail,
          weight,
        },
      }),
      prisma.action.update({
        where: { id: action.id },
        data: {
          reportScore: newScore,
          ...(shouldFlag && {
            isDisputed: true,
            disputeReason: `Acumulou ${newScore} pontos em denúncias.`,
          }),
        },
      }),
    ]);

    return {
      success: true,
      message: "Denúncia registrada. Obrigado pela colaboração.",
      flagged: shouldFlag,
    };
  });
