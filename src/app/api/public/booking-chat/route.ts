import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
  buildSystemPrompt,
  makeBookAppointmentTool,
  makeCancelAppointmentTool,
  makeGetAgendaInfoTool,
  makeGetAvailableSlotsTool,
  makeListMyAppointmentsTool,
} from "@/features/public-booking-chat/lib/booking-agent";
import dayjs from "dayjs";

// ─────────────────────────────────────────────
// RATE LIMITING — simples, por IP
// ─────────────────────────────────────────────
// Armazena contagem de requisições por IP em memória.
// Suficiente para bloquear abusos básicos em instâncias únicas.
// Para produção em multi-instância, usar Redis ou KV store.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;       // máximo de mensagens por janela
const RATE_LIMIT_WINDOW_MS = 60_000; // janela de 1 minuto

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ─────────────────────────────────────────────
// SCHEMA DE VALIDAÇÃO
// ─────────────────────────────────────────────
const requestSchema = z.object({
  messages: z.array(z.any()).min(1).max(50),
  orgSlug: z.string().min(1).max(100),
  agendaSlug: z.string().min(1).max(100),
  sessionId: z.string().optional(),
});

// ─────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Captura o IP do cliente para rate limiting e auditoria
  const headersList = await headers();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente em 1 minuto." },
      { status: 429 },
    );
  }

  // Validar corpo da requisição
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, orgSlug, agendaSlug, sessionId } = parsed.data;

  // Verificar se a agenda existe e está ativa
  const agenda = await prisma.agenda.findFirst({
    where: {
      slug: agendaSlug,
      organization: { slug: orgSlug },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      organization: { select: { name: true } },
    },
  });

  if (!agenda) {
    return NextResponse.json({ error: "Agenda não encontrada ou inativa." }, { status: 404 });
  }

  // Criar ou renovar sessão de chat público
  const userAgent = headersList.get("user-agent") ?? undefined;
  const expiresAt = dayjs().add(24, "hour").toDate();

  if (sessionId) {
    // Renovar sessão existente
    await prisma.publicChatSession.updateMany({
      where: {
        id: sessionId,
        agendaId: agenda.id,
        expiresAt: { gt: new Date() },
      },
      data: { expiresAt },
    });
  } else {
    // Nova sessão — criada em background, não bloqueia o streaming
    prisma.publicChatSession.create({
      data: {
        agendaId: agenda.id,
        orgSlug,
        agendaSlug,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    }).catch(() => {
      // Falha silenciosa — sessão é para auditoria, não crítica
    });
  }

  // ─────────────────────────────────────────────
  // STREAMING COM IA
  // ─────────────────────────────────────────────
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: buildSystemPrompt(agenda.name, agenda.organization.name),
    messages: modelMessages,
    stopWhen: stepCountIs(10), // limita chamadas recursivas de tools
    tools: {
      getAgendaInfo: makeGetAgendaInfoTool(orgSlug, agendaSlug),
      getAvailableSlots: makeGetAvailableSlotsTool(orgSlug, agendaSlug),
      listMyAppointments: makeListMyAppointmentsTool(orgSlug, agendaSlug),
      bookAppointment: makeBookAppointmentTool(orgSlug, agendaSlug),
      cancelAppointment: makeCancelAppointmentTool(orgSlug, agendaSlug),
    },
    // Segurança: limitar contexto para não vazar dados entre sessões
    maxOutputTokens: 2048,
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}
