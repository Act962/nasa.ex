import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

/** Lista cursos criados pela organização ativa do criador. */
export const creatorListCourses = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    const courses = await prisma.nasaRouteCourse.findMany({
      where: { creatorOrgId: orgId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        coverUrl: true,
        level: true,
        durationMin: true,
        format: true,
        priceStars: true,
        priceBrlCents: true,
        isFree: true,
        isPublished: true,
        publishedAt: true,
        studentsCount: true,
        rewardSpOnComplete: true,
        eventStartsAt: true,
        eventEndsAt: true,
        eventTimezone: true,
        category: { select: { id: true, slug: true, name: true } },
        creatorUser: { select: { id: true, name: true, image: true } },
        // Planos pra derivar o `displayPriceBrlCents` exibido no card.
        // Cursos antigos podem ter `course.priceBrlCents=0` mas planos com
        // preço real — o card deve refletir o que o aluno paga de fato.
        plans: {
          select: { priceBrlCents: true, isDefault: true, order: true },
          orderBy: [{ isDefault: "desc" }, { order: "asc" }],
        },
        _count: { select: { lessons: true, enrollments: true } },
      },
    });

    return {
      courses: courses.map((c) => {
        // Preço exibido = plano padrão (ou primeiro plano com preço) → fallback
        // pra `course.priceBrlCents`. Se nada > 0, é gratuito.
        const planPrice =
          c.plans.find((p) => p.isDefault && p.priceBrlCents > 0)
            ?.priceBrlCents ??
          c.plans.find((p) => p.priceBrlCents > 0)?.priceBrlCents ??
          0;
        const displayPriceBrlCents = planPrice > 0 ? planPrice : c.priceBrlCents;
        return { ...c, displayPriceBrlCents };
      }),
    };
  });
