import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/** Lista alunos matriculados nos cursos da org ativa. */
export const creatorListStudents = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      courseId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const enrollments = await prisma.nasaRouteEnrollment.findMany({
      where: {
        course: { creatorOrgId: orgId },
        ...(input.courseId ? { courseId: input.courseId } : {}),
      },
      orderBy: { enrolledAt: "desc" },
      take: 500,
      select: {
        id: true,
        enrolledAt: true,
        completedAt: true,
        source: true,
        paidStars: true,
        paidBrlCents: true,
        stripeCheckoutSessionId: true,
        stripePaymentIntentId: true,
        status: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        course: { select: { id: true, slug: true, title: true } },
        buyerOrg: { select: { id: true, name: true, slug: true } },
      },
    });

    return { enrollments };
  });
