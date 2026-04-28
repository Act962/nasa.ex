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

// ── Update profile — name, image (base64) and phone ──────────────────────────
export const updateProfile = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Update user profile" })
  .input(
    z.object({
      name: z.string().trim().min(1).max(120).optional(),
      image: z
        .string()
        .max(7_500_000) // ~5MB after base64 overhead
        .refine(
          (v) => v === "" || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v),
          "Imagem deve estar em base64 (data URL)",
        )
        .optional(),
      phone: z
        .string()
        .trim()
        .max(32)
        .regex(/^\+\d{1,4}\s?\d{6,15}$/, "Use o formato DDI + Telefone, ex: +55 11999999999")
        .optional()
        .or(z.literal("")),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const { user } = context;

    const data: { name?: string; image?: string | null; phone?: string | null } = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.image !== undefined) data.image = input.image === "" ? null : input.image;
    if (input.phone !== undefined) data.phone = input.phone === "" ? null : input.phone;

    if (Object.keys(data).length === 0) return { success: true };

    await prisma.user.update({ where: { id: user.id }, data });

    return { success: true };
  });

export const userRouter = { completeOnboarding, updateProfile };
