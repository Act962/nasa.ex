import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Registra uma visualização da página pública do curso. Públic — não
 * exige login. Loga em `SystemActivityLog` pra aparecer no painel de
 * Insights da NASA Route (`appSlug: "nasa-route"`).
 *
 * UTM params (`utm_source`, `utm_medium`, etc.) entram via `metadata`
 * pra permitir filtros e atribuição de campanha no Insights.
 *
 * Como é fire-and-forget, falhas são silenciosas (log no server) — não
 * queremos quebrar a navegação por causa de tracking interno.
 */
export const trackCourseView = base
  .use(optionalAuthMiddleware)
  .input(
    z.object({
      courseId: z.string().min(1),
      // UTM params opcionais — capturados da query string da página.
      utmSource: z.string().max(64).optional().nullable(),
      utmMedium: z.string().max(64).optional().nullable(),
      utmCampaign: z.string().max(128).optional().nullable(),
      utmContent: z.string().max(128).optional().nullable(),
      utmTerm: z.string().max(128).optional().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const course = await prisma.nasaRouteCourse.findUnique({
        where: { id: input.courseId },
        select: {
          id: true,
          title: true,
          creatorOrgId: true,
          isPublished: true,
        },
      });
      if (!course || !course.isPublished) {
        return { ok: false };
      }

      const user = context.user;

      await logActivity({
        organizationId: course.creatorOrgId,
        // Quando o visitante é anônimo, usa ID do criador como fallback
        // de actor (necessário pro logActivity — schema exige).
        userId: user?.id ?? "anonymous",
        userName: user?.name ?? "Visitante anônimo",
        userEmail: user?.email ?? "anonymous@nasa-route",
        userImage: (user as any)?.image ?? null,
        appSlug: "nasa-route",
        subAppSlug: "nasa-route-courses",
        featureKey: "route.course.viewed",
        action: "route.course.viewed",
        actionLabel: `Visualizou o curso "${course.title}"`,
        resource: course.title,
        resourceId: course.id,
        metadata: {
          courseId: course.id,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          utmContent: input.utmContent ?? null,
          utmTerm: input.utmTerm ?? null,
        },
      });

      return { ok: true };
    } catch (err) {
      console.error("[track-course-view] failed:", err);
      return { ok: false };
    }
  });
