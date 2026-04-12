import { auth } from "@/lib/auth";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

async function resolveApiKey(orgId: string): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId: orgId, platform: "ANTHROPIC", isActive: true },
    select: { config: true },
  });
  const integrationKey = (integration?.config as Record<string, string> | null)?.apiKey;
  if (integrationKey) return integrationKey;

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

  const { integration } = await request.json();
  if (!integration) {
    return NextResponse.json({ error: "Nome da integração é obrigatório" }, { status: 400 });
  }

  const apiKey = await resolveApiKey(session.session.activeOrganizationId);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chave da API Anthropic não configurada. Acesse Integrações → Anthropic e adicione sua chave." },
      { status: 500 }
    );
  }

  const anthropic = createAnthropic({ apiKey });

  const prompt = `Você é o ASTRO, assistente de IA do NASA CRM. Gere um guia passo a passo DETALHADO em português brasileiro para configurar a integração "${integration}".

Para Google Calendar, explique:
1. Como criar/selecionar projeto no Google Cloud Console (console.cloud.google.com)
2. Como ativar a Google Calendar API na Biblioteca de APIs
3. Como criar credenciais OAuth 2.0 (tipo Aplicativo da Web, URIs de redirecionamento)
4. Como usar o OAuth 2.0 Playground (developers.google.com/oauthplayground) para gerar o Refresh Token com escopo calendar.events
5. Dica: como encontrar o Calendar ID

Seja específico, direto, sem textos longos. Use emojis para tornar visual. Máximo 300 palavras. Não use markdown com # ou **, use apenas emojis e listas simples.`;

  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      prompt,
      maxTokens: 600,
    });

    return NextResponse.json({ guide: text });
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    const status = error?.status ?? error?.statusCode;
    console.error("[generate-guide] error status=%s message=%s", status, msg);
    if (status === 401 || msg?.includes("401")) {
      return NextResponse.json(
        { error: "Chave da API Anthropic inválida. Verifique em Integrações → Anthropic." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: `Erro ao gerar guia: ${msg}` }, { status: 500 });
  }
}
