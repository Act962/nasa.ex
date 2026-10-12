import "server-only";
import { recordAiUsage, type AiTokenUsage } from "@/features/ia/server/record-ai-usage";
import { loadTrafegoSettings } from "./trafego-settings";

// Registro do uso de IA do trafeGO (spec 0093, RF-5). O trafeGO atende clientes de fora da plataforma
// com a chave da própria operação, então o uso é lançado na empresa da agência. Sem agência
// configurada não há a quem atribuir e nada é gravado.

type TrafegoAiFeature = "trafego.assistant" | "trafego.recommendations" | "trafego.release" | "trafego.copies" | "trafego.compliance";

export async function recordTrafegoAiUsage(input: {
  feature: TrafegoAiFeature;
  provider: "openai" | "anthropic";
  modelId: string;
  usage?: AiTokenUsage | null;
  /** A conferência de anúncio pode rodar na chave que a agência cadastrou em Satélites. */
  isAgencyKey?: boolean;
}): Promise<void> {
  const settings = await loadTrafegoSettings().catch(() => null);
  if (!settings?.agencyOrganizationId) return;
  await recordAiUsage({
    resourceId: input.feature === "trafego.compliance" ? "trafego.compliance" : "trafego.assistant",
    feature: input.feature,
    organizationId: settings.agencyOrganizationId,
    provider: input.provider,
    modelId: input.modelId,
    keySource: input.isAgencyKey ? "organization" : "platform",
    usage: input.usage,
  });
}
