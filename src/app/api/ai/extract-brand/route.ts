import { auth } from "@/lib/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

async function resolveApiKey(orgId: string): Promise<string | null> {
  // 1. Env var (configurado no servidor)
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  // 2. Chave configurada em Integrações (PlatformIntegration)
  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId: orgId, platform: "ANTHROPIC", isActive: true },
    select: { config: true },
  });
  const integrationKey = (integration?.config as Record<string, string> | null)?.apiKey;
  if (integrationKey) return integrationKey;

  // 3. Chave configurada em qualquer Planner da organização
  const planner = await prisma.nasaPlanner.findFirst({
    where: { organizationId: orgId, anthropicApiKey: { not: null } },
    select: { anthropicApiKey: true },
    orderBy: { updatedAt: "desc" },
  });

  return planner?.anthropicApiKey ?? null;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !session.session.activeOrganizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { source } = await request.json();
  if (!source) {
    return NextResponse.json({ error: "Informe um Instagram ou URL do site" }, { status: 400 });
  }

  const apiKey = await resolveApiKey(session.session.activeOrganizationId);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chave da API Anthropic não configurada. Acesse um Planner → aba IA e insira sua chave." },
      { status: 500 }
    );
  }

  const anthropic = createAnthropic({ apiKey });

  const prompt = `Você é um especialista em branding e marketing. A partir da fonte abaixo (pode ser um perfil de Instagram, URL de site ou nome de marca), extraia e deduza as informações de marca estruturadas.

Fonte: ${source}

Responda APENAS com um JSON válido no seguinte formato (sem markdown, sem explicações):
{
  "slogan": "slogan da marca ou proposta de valor em 1 frase",
  "website": "URL do site oficial se detectado, senão null",
  "icp": "Descrição do ICP (Perfil de Cliente Ideal): quem é o público-alvo, faixa etária, dores, desejos, comportamento de compra",
  "positioning": "Como a marca se posiciona no mercado: proposta de valor, diferenciação, território de marca",
  "voiceTone": "Voz e tom da comunicação: formal/informal, jovem/maduro, emocional/racional, palavras-chave usadas, estilo de copywriting",
  "visual": {
    "style": "Descrição do estilo visual: minimalista, colorido, premium, etc.",
    "primaryColors": ["#cor1", "#cor2"],
    "typography": "Estilo tipográfico: serifado, sans-serif, moderno, clássico",
    "imagery": "Tipo de imagens/conteúdo visual predominante"
  },
  "aiInstructions": "Instruções para a IA gerar conteúdo alinhado à marca: tom, restrições, palavras a evitar, CTAs preferenciais",
  "swot": {
    "strengths": "Pontos fortes identificados da marca",
    "weaknesses": "Possíveis pontos fracos ou oportunidades de melhoria",
    "opportunities": "Oportunidades de mercado para a marca",
    "threats": "Ameaças ou concorrentes no segmento"
  }
}`;

  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt,
      maxTokens: 1500,
    });

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const brand = JSON.parse(cleaned);

    return NextResponse.json({ brand });
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    const status = error?.status ?? error?.statusCode;
    console.error("[extract-brand] error status=%s message=%s", status, msg, error);
    if (status === 401 || msg?.includes("401")) {
      return NextResponse.json(
        { error: "Chave da API Anthropic inválida. Verifique em Integrações → Anthropic." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: `Erro ao extrair informações da marca: ${msg}` },
      { status: 500 }
    );
  }
}
