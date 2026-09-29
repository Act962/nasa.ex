import "server-only";
import prisma from "@/lib/prisma";

// 👍/👎 das respostas do ASTRO (spec 0028, RF-15). A API fala UP/DOWN; o
// banco guarda o enum AstroFeedbackRating (POSITIVE/NEGATIVE) — mandar UP
// direto ao Prisma derrubava o joinha com erro 500.

export type FeedbackRating = "UP" | "DOWN";

export async function recordAstroFeedback(params: {
  organizationId: string;
  userId: string;
  rating: FeedbackRating;
  sessionId?: string;
  messageId?: string;
  correction?: string;
  answerExcerpt?: string;
}): Promise<{ id: string }> {
  return prisma.astroFeedback.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      rating: params.rating === "UP" ? "POSITIVE" : "NEGATIVE",
      sessionId: params.sessionId ?? null,
      messageId: params.messageId ?? null,
      correction: params.correction ?? null,
      answerExcerpt: params.answerExcerpt ?? null,
    },
    select: { id: true },
  });
}

export function toFeedbackRating(stored: "POSITIVE" | "NEGATIVE"): FeedbackRating {
  return stored === "POSITIVE" ? "UP" : "DOWN";
}
