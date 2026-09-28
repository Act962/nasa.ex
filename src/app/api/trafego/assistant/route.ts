/**
 * POST /api/trafego/assistant
 *
 * Chat público do trafeGO — o Astro falando com quem ainda não é cliente.
 *
 * Público de verdade: sem sessão, sem organização. Por isso o conjunto de
 * ferramentas é só de leitura (ver `assistant-tools.ts`) e nada deste caminho
 * importa `src/features/astro`, cujas ferramentas escrevem no banco da org.
 *
 * Não persiste conversa: não há a quem atribuir, e guardar texto de visitante
 * anônimo criaria um passivo de LGPD sem contrapartida.
 */

import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { z } from "zod";
import { clientIpFromHeaders, takeRateLimit } from "@/lib/rate-limit";
import { buildAssistantPrompt } from "@/features/trafego/lib/assistant-prompt";
import { buildAssistantTools } from "@/features/trafego/server/lib/assistant-tools";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  messages: z.array(z.any()).min(1).max(40),
  context: z
    .object({
      platform: z.enum(["META_ADS", "GOOGLE_ADS", "WHATSAPP_OFICIAL"]).nullish(),
      objective: z.string().max(60).nullish(),
      campaignType: z.string().max(60).nullish(),
      businessName: z.string().max(120).nullish(),
      segment: z.string().max(120).nullish(),
      adBudgetBrlCents: z.number().int().min(0).max(100_000_000).nullish(),
      totalBrlCents: z.number().int().min(0).max(200_000_000).nullish(),
      feePercent: z.number().min(0).max(100).nullish(),
      setupBrlCents: z.number().int().min(0).max(10_000_000).nullish(),
      earliestStart: z.string().max(80).nullish(),
    })
    .default({}),
});

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Assistente indisponível no momento." },
      { status: 503 },
    );
  }

  const ip = clientIpFromHeaders(request.headers);
  const limit = takeRateLimit("trafego-assistant", ip, { max: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Muitas mensagens. Tente de novo em ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // O WhatsApp da equipe é a única coisa que vem do banco aqui — e falha nele
  // não pode derrubar o chat.
  const settings = await loadTrafegoSettings().catch(() => null);
  const supportWhatsapp = settings?.supportWhatsapp ?? null;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: buildAssistantPrompt({ ...parsed.data.context, supportWhatsapp }),
    messages: await convertToModelMessages(parsed.data.messages),
    tools: buildAssistantTools(supportWhatsapp),
    // Quatro passos bastam para simular preço, checar política e responder.
    stopWhen: stepCountIs(4),
    maxOutputTokens: 900,
    temperature: 0.3,
    experimental_telemetry: { isEnabled: true, functionId: "trafego-assistant" },
  });

  return result.toUIMessageStreamResponse();
}
