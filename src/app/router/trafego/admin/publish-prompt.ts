import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  TrafegoOrderNotFoundError,
  loadOrderPublishPrompt,
  sendRecommendationForApproval,
} from "@/features/trafego/server/lib/order-publish";

/**
 * Prompt para o Claude da equipe e envio da recomendação ao cliente (spec 0130, RF-6, RF-7).
 * Só admin do sistema; o prompt nunca leva token. A regra mora em `order-publish.ts`.
 */

function rethrowNotFound(error: unknown): never {
  if (error instanceof TrafegoOrderNotFoundError) throw new ORPCError("NOT_FOUND", { message: error.message });
  throw error;
}

export const buildTrafegoPublishPrompt = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1) }))
  .handler(({ input }) => loadOrderPublishPrompt(input.orderId).catch(rethrowNotFound));

export const sendTrafegoRecommendationForApproval = base
  .use(requireAdminMiddleware)
  .input(
    z.object({
      orderId: z.string().min(1),
      recommendation: z.string().trim().min(10, "Cole a recomendação do Claude.").max(4000),
    }),
  )
  .handler(({ input, context }) =>
    sendRecommendationForApproval({
      orderId: input.orderId,
      recommendation: input.recommendation,
      actorUserId: context.user.id,
    }).catch(rethrowNotFound),
  );
