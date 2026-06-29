import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireCourseManager } from "../utils";
import {
  computeVideoUploadCost,
  VIDEO_UPLOAD_MAX_BYTES,
} from "@/features/nasa-route/lib/video-storage-pricing";
import { getStarPriceBrl } from "@/features/nasa-route/lib/pricing";

/**
 * Quote pra upload de vídeo: dado o tamanho do arquivo, retorna o custo em
 * STARs e o saldo atual da org. NÃO debita nada — é só pré-confirmação pra
 * mostrar no modal "Esse vídeo custará X★. Confirmar?".
 *
 * Em seguida o frontend chama `creatorStartVideoUpload` que faz o debit real.
 */
export const creatorQuoteVideoUpload = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      sizeBytes: z
        .number()
        .int()
        .min(1)
        .max(VIDEO_UPLOAD_MAX_BYTES, "Vídeo excede o limite de 2 GB"),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireCourseManager(context.user.id, input.courseId);

    const starPriceBrl = await getStarPriceBrl();
    const breakdown = computeVideoUploadCost(input.sizeBytes, starPriceBrl);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: context.org.id },
      select: { starsBalance: true, starsBonusBalance: true },
    });

    return {
      costStars: breakdown.stars,
      breakdown,
      currentBalance: org.starsBalance,
      bonusBalance: org.starsBonusBalance,
      // STARs bônus NÃO são consumidas neste fluxo (allowBonus=false no debit) —
      // ficam reservadas pra integrações IA. A UI usa só `currentBalance`
      // pra decidir se há saldo suficiente.
      hasSufficientBalance: org.starsBalance >= breakdown.stars,
    };
  });
