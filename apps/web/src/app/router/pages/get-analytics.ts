import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Agrega NasaPageVisit em métricas exibíveis no painel:
 *
 * - `totalVisits`: page-views (registros sem `_evt:` prefix)
 * - `byDevice`: { desktop, tablet, mobile }
 * - `scrollDepth`: % de visitantes que chegaram em cada marker
 *   (25, 50, 75, 100)
 * - `avgDwellSeconds`: média dos eventos dwell
 * - `topClicked`: top 10 element IDs mais clicados
 * - `topSections`: top 10 sections com mais view (intersection)
 * - `byDay`: contagem de page-views por dia (últimos N)
 *
 * Os eventos custom estão codificados em `path` como
 * `_evt:<type>:<targetId>:<value>` — convenção definida em
 * register-visit pra evitar migration de schema.
 */
export const getPageAnalytics = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/pages/:id/analytics",
    summary: "Analytics agregadas da page (visitas, clicks, scroll, dwell)",
  })
  .input(
    z.object({
      id: z.string(),
      days: z.number().min(1).max(365).default(30),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.BAD_REQUEST({ message: "Organização não encontrada" });
    }
    const page = await prisma.nasaPage.findFirst({
      where: { id: input.id, organizationId },
      select: { id: true },
    });
    if (!page) {
      throw errors.NOT_FOUND({ message: "Página não encontrada" });
    }

    const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
    const visits = await prisma.nasaPageVisit.findMany({
      where: { pageId: page.id, createdAt: { gte: since } },
      select: {
        id: true,
        path: true,
        device: true,
        country: true,
        referrer: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    // Separa page-views de eventos custom
    const pageViews = visits.filter((v) => !v.path?.startsWith("_evt:"));
    const events = visits.filter((v) => v.path?.startsWith("_evt:"));

    // ── Métricas básicas ────────────────────────────────────────
    const totalVisits = pageViews.length;
    const byDevice = pageViews.reduce(
      (acc, v) => {
        const d = v.device ?? "desktop";
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // ── Eventos parseados ───────────────────────────────────────
    const parsed = events
      .map((v) => {
        const parts = v.path!.split(":");
        return {
          type: parts[1] ?? "",
          targetId: parts[2] ?? "",
          value: parts.slice(3).join(":"),
          createdAt: v.createdAt,
        };
      })
      .filter((e) => e.type);

    // Scroll markers — % de visitantes que chegaram em cada threshold
    const scrollCounts = parsed
      .filter((e) => e.type === "scroll")
      .reduce(
        (acc, e) => {
          const m = parseInt(e.value, 10);
          if ([25, 50, 75, 100].includes(m))
            acc[m] = (acc[m] ?? 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );
    const scrollDepth = {
      p25:
        totalVisits > 0
          ? Math.round(((scrollCounts[25] ?? 0) / totalVisits) * 100)
          : 0,
      p50:
        totalVisits > 0
          ? Math.round(((scrollCounts[50] ?? 0) / totalVisits) * 100)
          : 0,
      p75:
        totalVisits > 0
          ? Math.round(((scrollCounts[75] ?? 0) / totalVisits) * 100)
          : 0,
      p100:
        totalVisits > 0
          ? Math.round(((scrollCounts[100] ?? 0) / totalVisits) * 100)
          : 0,
    };

    // Dwell — média
    const dwells = parsed
      .filter((e) => e.type === "dwell")
      .map((e) => parseInt(e.value, 10))
      .filter((n) => !isNaN(n) && n > 0 && n < 3600);
    const avgDwellSeconds =
      dwells.length > 0
        ? Math.round(dwells.reduce((a, b) => a + b, 0) / dwells.length)
        : 0;

    // Top clicks
    const clickCounts = parsed
      .filter((e) => e.type === "click" && e.targetId)
      .reduce(
        (acc, e) => {
          acc[e.targetId] = (acc[e.targetId] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    const topClicked = Object.entries(clickCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([targetId, count]) => ({ targetId, count }));

    // Top sections vistas
    const sectionCounts = parsed
      .filter((e) => e.type === "section" && e.targetId)
      .reduce(
        (acc, e) => {
          acc[e.targetId] = (acc[e.targetId] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    const topSections = Object.entries(sectionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([targetId, count]) => ({ targetId, count }));

    // Por dia
    const byDay = pageViews.reduce(
      (acc, v) => {
        const day = v.createdAt.toISOString().slice(0, 10);
        acc[day] = (acc[day] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Top referrers
    const referrerCounts = pageViews.reduce(
      (acc, v) => {
        if (v.referrer) {
          let host = "(direto)";
          try {
            host = new URL(v.referrer).hostname;
          } catch {
            /* ignora */
          }
          acc[host] = (acc[host] ?? 0) + 1;
        } else {
          acc["(direto)"] = (acc["(direto)"] ?? 0) + 1;
        }
        return acc;
      },
      {} as Record<string, number>,
    );
    const topReferrers = Object.entries(referrerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([host, count]) => ({ host, count }));

    return {
      totalVisits,
      byDevice,
      scrollDepth,
      avgDwellSeconds,
      topClicked,
      topSections,
      topReferrers,
      byDay,
      eventsTotal: events.length,
      sinceDays: input.days,
    };
  });
