import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { AI_RESOURCES, AI_RESOURCE_BY_ID } from "@/features/ia/lib/ai-resources";
import { describeAiResource, type AiResourceStatus } from "@/features/ia/lib/describe-ai-resource";
import { periodStart, aiUseGroupOf } from "@/features/ia/lib/ai-use-groups";
import { SELECTOR_WIRED_RESOURCE_IDS } from "@/features/ia/lib/ai-preferences";
import { decideAiFor } from "@/features/ia/lib/decide-ai-for";
import { loadAiKeyFacts } from "@/features/ia/server/load-ai-key-facts";
import { loadAiPreferences } from "@/features/ia/server/resolve-ai-for";
import { EMPTY_USAGE, isCompanyAiManager, loadAiUsage, loadAverageReplyTokens, usageKey, type ResourceUsage } from "@/features/ia/server/load-ai-usage";

// "IA da empresa" (spec 0093, RF-6 e RF-10): para cada recurso de IA, o modelo, de qual chave sai,
// quem paga e o uso do período. Só dono e admin. Nunca devolve chave: só o provedor e o final dela.

export const getAiResourcesOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/ia/resources-overview", summary: "Recursos de IA da empresa: modelo, chave, quem paga e uso" })
  .input(z.object({ period: z.enum(["today", "7d", "month"]).default("month") }).optional())
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (!(await isCompanyAiManager(organizationId, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Só o dono ou um administrador da empresa vê as chaves e o consumo de IA." });
    }
    const period = input?.period ?? "month";

    const featuresOf = (resourceId: string) => AI_RESOURCE_BY_ID.get(resourceId)?.usageFeatures ?? [];
    const [preferences, { facts, funnels }, { usageByKey, unassigned }, attendanceAverage, flowsAverage, astroAverage] = await Promise.all([
      loadAiPreferences(organizationId),
      loadAiKeyFacts(organizationId),
      loadAiUsage(organizationId, periodStart(period)),
      loadAverageReplyTokens(organizationId, featuresOf("attendance.chat")),
      loadAverageReplyTokens(organizationId, featuresOf("workflows.ai-steps")),
      loadAverageReplyTokens(organizationId, featuresOf("astro.chat")),
    ]);

    const rows: (AiResourceStatus & {
      app: string;
      label: string;
      description: string;
      kind: string;
      keyRule: string;
      settingsPlace: string;
      useGroup: string;
      /** Já ligado ao seletor único: a chave da empresa pode ser ligada aqui em "Funciona em". */
      isSelectorWired: boolean;
      isCompanyKeyRequested: boolean;
      /** Provedor que o recurso usa na plataforma: é a chave desse provedor que entra no lugar. */
      platformProvider: string | null;
      usage: ResourceUsage;
    })[] = [];
    for (const resource of AI_RESOURCES) {
      const details = {
        app: resource.app,
        label: resource.label,
        description: resource.description,
        kind: resource.kind,
        keyRule: resource.keyRule,
        settingsPlace: resource.settingsPlace,
        useGroup: aiUseGroupOf(resource.id),
        isSelectorWired: SELECTOR_WIRED_RESOURCE_IDS.has(resource.id),
        isCompanyKeyRequested: preferences.companyKeyResources.includes(resource.id),
      };
      if (resource.isPerTracking) {
        for (const funnel of funnels) {
          rows.push({
            ...decideAiFor(resource, facts, preferences, funnel),
            ...details,
            platformProvider: describeAiResource(resource, facts, funnel).provider,
            usage: usageByKey.get(usageKey(resource.id, funnel.trackingId)) ?? EMPTY_USAGE,
          });
        }
        continue;
      }
      rows.push({ ...decideAiFor(resource, facts, preferences), ...details, platformProvider: describeAiResource(resource, facts).provider, usage: usageByKey.get(resource.id) ?? EMPTY_USAGE });
    }

    return {
      period,
      rows,
      unassignedUsage: unassigned,
      preferences,
      // Tamanho médio real de uma chamada, para o custo "na prática". `null` = poucos usos: vale a conversa de exemplo.
      averageReplyTokens: { attendance: attendanceAverage, flows: flowsAverage, astro: astroAverage },
      keys: {
        company: Object.entries(facts.companyKeys).map(([provider, key]) => ({ provider, last4: key.last4 })),
        platform: facts.platformKeys,
        funnels: funnels.filter((funnel) => funnel.hasOwnKey).map((funnel) => ({ trackingId: funnel.trackingId, trackingName: funnel.trackingName, provider: funnel.provider, last4: funnel.keyLast4 })),
        hasPlannerKey: facts.hasPlannerAnthropicKey,
      },
    };
  });
