// Prompt que a equipe cola no Claude para montar a campanha (spec 0130, RF-6, D-2).
// Regra fixa: mesmo pedido, mesmo texto. Nunca leva token nem segredo, só o id da conta.

import type { CreativeGuidance } from "./creative-review/guidance";

export interface PublishPromptInput {
  code: string;
  businessName: string;
  businessNiche: string | null;
  objectiveLabel: string;
  campaignTypeLabel: string;
  targetAudience: string | null;
  adBudgetBrlCents: number;
  durationDays: number;
  desiredStartAt: string | null;
  adAccountId: string | null;
  page: { id: string; name: string; whatsappNumber: string | null; instagramUsername: string | null } | null;
  copy: { message: string; headline: string | null } | null;
  initialMessage: string | null;
  creative: { url: string; kind: "IMAGE" | "VIDEO"; fileName: string | null } | null;
  postLink: string | null;
  guidance: CreativeGuidance | null;
}

export type PublishPromptResult = { ok: true; text: string; pending: string[] } | { ok: false; missing: string[] };

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildPublishPrompt(input: PublishPromptInput): PublishPromptResult {
  const missing = [
    !input.creative && !input.postLink && "o criativo (arquivo ou link do post)",
    !input.copy?.message.trim() && "o texto do anúncio",
  ].filter((item): item is string => Boolean(item));
  if (missing.length > 0) return { ok: false, missing };

  // Sem estes dá para montar, mas a equipe confirma com o cliente uma vez só (CB-1, CB-2).
  const pending = [
    !input.targetAudience?.includes("Localização") && "cidade ou região do público",
    !input.initialMessage?.trim() && "mensagem inicial do WhatsApp",
    !input.page && "página do Facebook (confirmar no Gerenciador)",
    !input.page?.whatsappNumber && "WhatsApp ligado à página",
    !input.adAccountId && "conta de anúncios (o cliente não conectou nos Satélites)",
  ].filter((item): item is string => Boolean(item));

  const dailyBudgetCents = Math.round(input.adBudgetBrlCents / Math.max(1, input.durationDays));
  const campaignName = `${input.code} — ${input.businessName} — Mensagens`;
  const copy = input.copy as { message: string; headline: string | null };

  const lines = [
    `Monte uma campanha de anúncios na Meta para o pedido ${input.code} do trafeGO, usando o MCP de anúncios da Meta.`,
    "",
    "## Regras de trabalho",
    `- Use somente a conta de anúncios ${input.adAccountId ?? "(confirmar com a equipe)"}. Não mexa em outras campanhas.`,
    "- Crie TUDO PAUSADO (campanha, conjunto e anúncio). Nunca ative: quem ativa é a equipe, depois que o cliente aprovar.",
    "- Campanha de mensagens com destino WhatsApp (botão \"Enviar mensagem no WhatsApp\").",
    `- Nome da campanha: "${campaignName}". Conjunto e anúncio com o mesmo prefixo ${input.code}.`,
    "- Siga as políticas de anúncio da Meta. Em saúde e estética: sem atributos pessoais, sem promessa de resultado, sem antes e depois.",
    "- Se algo abaixo impedir a criação ou parecer errado, não invente: pare e explique.",
    "",
    "## Dados do anúncio",
    `- Negócio: ${input.businessName}${input.businessNiche ? ` (${input.businessNiche})` : ""}`,
    `- Tipo de campanha: ${input.campaignTypeLabel} · Objetivo escolhido: ${input.objectiveLabel}`,
    input.page
      ? `- Página: ${input.page.name} (id ${input.page.id})${input.page.instagramUsername ? ` · Instagram @${input.page.instagramUsername}` : ""}${input.page.whatsappNumber ? ` · WhatsApp ${input.page.whatsappNumber}` : ""}`
      : "- Página: confirmar no Gerenciador.",
    `- Público: ${input.targetAudience || "a definir"}`,
    `- Verba total: ${formatBrl(input.adBudgetBrlCents)} em ${input.durationDays} dias (cerca de ${formatBrl(dailyBudgetCents)} por dia)`,
    `- Início desejado: ${input.desiredStartAt ?? "assim que aprovado"}`,
    input.creative
      ? `- Criativo (${input.creative.kind === "VIDEO" ? "vídeo" : "imagem"}${input.creative.fileName ? `, ${input.creative.fileName}` : ""}): ${input.creative.url}\n  O link vale 24 horas.`
      : `- Criativo: impulsionar o post existente ${input.postLink}`,
    `- Texto principal:\n"""\n${copy.message.trim()}\n"""`,
    `- Título: ${copy.headline?.trim() || "(sem título)"}`,
    `- Mensagem inicial no WhatsApp: ${input.initialMessage?.trim() || "(a definir)"}`,
  ];

  if (input.guidance) {
    lines.push(
      "",
      "## Orientação do Astro (baseada no histórico da conta)",
      `- Objetivo: ${input.guidance.objective.value}. ${input.guidance.objective.reason}`,
      `- Público: ${input.guidance.audience.gender}, ${input.guidance.audience.age}${input.guidance.audience.interests.length ? `, interesses ${input.guidance.audience.interests.join(", ")}` : ""}. ${input.guidance.audience.reason}`,
    );
  }

  if (pending.length > 0) {
    lines.push("", "## Falta confirmar com o cliente", ...pending.map((item) => `- ${item}`));
  }

  lines.push(
    "",
    "## Ao terminar",
    "1. Liste o que foi criado (ids da campanha, do conjunto e do anúncio), tudo pausado.",
    "2. Termine com um bloco exatamente assim, em linguagem simples para o dono do negócio:",
    "RECOMENDAÇÕES PARA O CLIENTE",
    "- (cada mudança que você recomenda no texto, público, verba ou criativo, com o porquê em uma frase)",
    "Se não houver recomendação, escreva só: RECOMENDAÇÕES PARA O CLIENTE: Nenhuma",
  );

  return { ok: true, text: lines.join("\n"), pending };
}
