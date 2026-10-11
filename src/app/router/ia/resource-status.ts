import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { BAND_LABEL, MODEL_GUIDE_BY_ID } from "@/features/ia/lib/ai-model-guide";
import { AI_RESOURCE_BY_ID } from "@/features/ia/lib/ai-resources";
import { aiBadgeStateOf } from "@/features/ia/lib/ai-badge-state";
import { decideAiFor } from "@/features/ia/lib/decide-ai-for";
import { periodStart } from "@/features/ia/lib/ai-use-groups";
import { loadAiKeyFacts } from "@/features/ia/server/load-ai-key-facts";
import { loadAiPreferences } from "@/features/ia/server/resolve-ai-for";
import { EMPTY_USAGE, isCompanyAiManager, loadAiUsage, loadAverageReplyTokens, usageKey } from "@/features/ia/server/load-ai-usage";

// Selo de IA dentro de cada App (spec 0093, RF-11): diz se o recurso roda na chave da empresa, na IA
// básica da plataforma ou se está desligado. Qualquer membro recebe o estado; chave, modelo e valores
// só vão para dono e admin.

const PROVIDER_LABEL: Record<string, string> = { openai: "OpenAI", google: "Gemini", anthropic: "Anthropic" };

export const getAiResourceStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/ia/resource-status", summary: "Estado da IA de um recurso para o selo dos Apps" })
  .input(z.object({ resourceId: z.string().min(1).max(80), trackingId: z.string().min(1).max(64).optional() }))
  .handler(async ({ input, context, errors }) => {
    const resource = AI_RESOURCE_BY_ID.get(input.resourceId);
    if (!resource) throw errors.NOT_FOUND({ message: "Recurso de IA desconhecido." });

    const organizationId = context.org.id;
    const [{ facts, funnels }, preferences] = await Promise.all([loadAiKeyFacts(organizationId), loadAiPreferences(organizationId)]);
    // O funil vem da lista da própria empresa: id de outra empresa simplesmente não é encontrado.
    const funnel = resource.isPerTracking && input.trackingId ? funnels.find((candidate) => candidate.trackingId === input.trackingId) : undefined;
    const status = decideAiFor(resource, facts, preferences, funnel);
    const state = aiBadgeStateOf(status.keySource);

    if (!(await isCompanyAiManager(organizationId, context.user.id))) return { state, label: resource.label, detail: null };

    const [{ usageByKey }, averageReplyTokens] = await Promise.all([
      loadAiUsage(organizationId, periodStart("month")),
      resource.kind === "text" ? loadAverageReplyTokens(organizationId, resource.usageFeatures, funnel?.trackingId) : null,
    ]);
    const usage = usageByKey.get(usageKey(resource.id, funnel?.trackingId)) ?? EMPTY_USAGE;
    const guide = status.modelId ? MODEL_GUIDE_BY_ID.get(status.modelId) : undefined;
    return {
      state,
      label: resource.label,
      detail: {
        keySource: status.keySource,
        providerLabel: status.provider ? (PROVIDER_LABEL[status.provider] ?? null) : null,
        keyLast4: status.keyLast4,
        modelName: guide?.name ?? status.modelId,
        bandLabel: guide ? BAND_LABEL[guide.band] : null,
        note: status.note,
        monthCalls: usage.calls,
        monthCostBrl: usage.costBrl,
        monthStars: usage.stars,
        isCostPartial: usage.unpricedCalls > 0,
        averageReplyTokens,
        trackingId: funnel?.trackingId ?? null,
        settingsPlace: resource.settingsPlace,
      },
    };
  });
