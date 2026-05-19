import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import {
  ALERT_CATALOG,
  ALERT_CATEGORIES,
  APP_KEYS,
  APP_LABELS,
  getActiveAppKeys,
} from "@/features/alerts/lib/alert-catalog";
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
      apps: z.array(
        z.object({
          key: z.enum(APP_KEYS),
          label: z.string(),
        }),
      ),
      events: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          description: z.string(),
          category: z.string(),
          appKey: z.enum(APP_KEYS),
          audienceOptions: z.array(z.string()),
          supportsCooldown: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const activeApps = getActiveAppKeys();
    return {
      categories: [...ALERT_CATEGORIES],
      apps: activeApps.map((k) => ({ key: k, label: APP_LABELS[k] })),
      events: ALERT_CATALOG.map((d) => ({
        key: d.key,
        label: d.label,
        description: d.description,
        category: d.category,
        appKey: d.appKey,
        audienceOptions: [...d.audienceOptions],
        supportsCooldown: d.supportsCooldown,
      })),
    };
  });
