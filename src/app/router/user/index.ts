import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// ── Complete onboarding — marks user + awards 10 Space Points ─────────────────
export const completeOnboarding = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Complete onboarding" })
  .input(z.object({}))
  .output(z.object({ success: z.boolean(), alreadyCompleted: z.boolean() }))
  .handler(async ({ context }) => {
    const { user, session } = context;

    // Idempotency: only process once
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { onboardingCompletedAt: true },
    });
    if (dbUser?.onboardingCompletedAt) {
      return { success: true, alreadyCompleted: true };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompletedAt: new Date() },
    });

    // Award 10 Space Points if inside an org
    const orgId = session.activeOrganizationId;
    if (orgId) {
      const userPoint = await prisma.userSpacePoint.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          orgId,
          totalPoints: 10,
          weeklyPoints: 10,
          weekStart: new Date(),
        },
        update: {
          totalPoints: { increment: 10 },
          weeklyPoints: { increment: 10 },
        },
      });
      await prisma.spacePointTransaction.create({
        data: {
          userPointId: userPoint.id,
          points: 10,
          description: "🚀 Missão de Boas-Vindas completa! Bem-vindo ao NASA!",
          metadata: { source: "onboarding" },
        },
      });
    }

    return { success: true, alreadyCompleted: false };
  });

export const userRouter = { completeOnboarding };
