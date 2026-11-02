import { base } from "@/app/middlewares/base";
import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { OrderReviewError, recordOrderReview } from "@/features/trafego/server/lib/order-review";
import { markOrderPublished } from "@/features/trafego/server/lib/order-review-actions";

/** Saída de emergência quando a rotina do Claude para (spec 0132, RF-9): aprovar à mão e marcar como publicado. */

function rethrowReviewError(error: unknown): never {
  if (error instanceof OrderReviewError) throw new ORPCError("BAD_REQUEST", { message: error.message });
  throw error;
}

export const approveTrafegoOrderReview = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1), summary: z.string().trim().max(1000).optional() }))
  .handler(({ input, context }) =>
    recordOrderReview({
      orderId: input.orderId,
      verdict: "approved",
      summary: input.summary || "Anúncio conferido e aprovado pela equipe.",
      actorUserId: context.adminUser.id,
    }).catch(rethrowReviewError),
  );

export const markTrafegoOrderPublished = base
  .use(requireAdminMiddleware)
  .input(z.object({ orderId: z.string().min(1), metaCampaignId: z.string().regex(/^\d{6,25}$/, "Use o id numérico da campanha") }))
  .handler(({ input, context }) =>
    markOrderPublished({
      orderId: input.orderId,
      metaCampaignId: input.metaCampaignId,
      actorUserId: context.adminUser.id,
      viaLabel: `admin · ${context.adminUser.name}`,
    }).catch(rethrowReviewError),
  );
