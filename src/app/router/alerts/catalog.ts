import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { ALERT_CATALOG, ALERT_CATEGORIES } from "@/features/alerts/lib/alert-catalog";
import { z } from "zod";

/**
 * Retorna o catálogo de eventos suportados pelo alert engine.
 *
 * Serializa cada definição sem os Zod schemas (não viajam pelo wire).
 * Cliente usa pra montar o composer de regras no Astro Command (Fase 3+).
 */
export const getAlertCatalog = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/alerts/catalog",
    summary: "Lista os tipos de evento que o alert engine suporta",
  })
  .input(z.object({}).optional())
  .output(
    z.object({
      categories: z.array(z.string()),
      events: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          description: z.string(),
          category: z.string(),
          audienceOptions: z.array(z.string()),
          supportsCooldown: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async () => {
    return {
      categories: [...ALERT_CATEGORIES],
      events: ALERT_CATALOG.map((d) => ({
        key: d.key,
        label: d.label,
        description: d.description,
        category: d.category,
        audienceOptions: [...d.audienceOptions],
        supportsCooldown: d.supportsCooldown,
      })),
    };
  });
