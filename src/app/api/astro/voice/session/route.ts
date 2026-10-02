import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasAppPermission } from "@/features/permissions/server/app-permission";
import { envKeyFor, loadOrganizationKeys } from "@/features/ia/lib/router/providers";
import { resolveAstroAiMode } from "@/features/astro/lib/resolve-astro-ai-mode";
import { buildVoiceSessionConfig, resolveVoiceModel } from "@/features/astro/server/voice/build-voice-session-config";
import { signVoiceCallToken, VOICE_CALL_MAX_MS } from "@/features/astro/server/voice/voice-call-token";
import { chargeVoiceMinute } from "@/features/astro/server/voice/charge-voice-minute";

/** Abre uma chamada de voz com o ASTRO: devolve só o segredo efêmero da OpenAI, nunca a chave (spec 0054, D-3). */

export const runtime = "nodejs";

const MAX_CALLS_PER_HOUR = 6;
const HOUR_MS = 60 * 60 * 1000;
const callStartsByUser = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const recentStarts = (callStartsByUser.get(userId) ?? []).filter((startedAt) => Date.now() - startedAt < HOUR_MS);
  callStartsByUser.set(userId, recentStarts);
  return recentStarts.length >= MAX_CALLS_PER_HOUR;
}

function registerCallStart(userId: string) {
  callStartsByUser.set(userId, [...(callStartsByUser.get(userId) ?? []), Date.now()]);
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ code, error: message }, { status });
}

export async function POST(request: Request) {
  if (process.env.ASTRO_VOICE_REALTIME === "false") {
    return errorResponse("VOICE_DISABLED", "Voz em tempo real desligada.", 503);
  }

  const sessionData = await auth.api.getSession({ headers: await headers() });
  if (!sessionData?.user || !sessionData.session.activeOrganizationId) {
    return errorResponse("UNAUTHORIZED", "Não autorizado", 401);
  }
  const userId = sessionData.user.id;
  const organizationId = sessionData.session.activeOrganizationId;

  const canUseAstro = await hasAppPermission(organizationId, userId, "astro", "canView");
  if (!canUseAstro) {
    return errorResponse("FORBIDDEN", "Seu papel não tem acesso ao Astro.", 403);
  }
  if (isRateLimited(userId)) {
    return errorResponse("RATE_LIMITED", "Muitas chamadas na última hora. Tente de novo daqui a pouco.", 429);
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, starsSuspendedAt: true },
  });
  if (organization?.starsSuspendedAt) {
    return errorResponse("STARS_SUSPENDED", "Conta suspensa por falta de Stars. Recarregue para conversar com o Astro.", 402);
  }

  const organizationKeys = await loadOrganizationKeys(organizationId);
  const organizationOpenAiKey = organizationKeys.openai?.apiKey;
  if (!organizationOpenAiKey) {
    const aiMode = await resolveAstroAiMode(organizationId);
    if (aiMode === null) {
      return errorResponse("CHOOSE_AI", "Escolha a IA do Astro antes de conversar por voz.", 409);
    }
  }
  const apiKey = organizationOpenAiKey ?? envKeyFor("openai");
  if (!apiKey) {
    return errorResponse("NO_VOICE_KEY", "Voz indisponível: nenhuma chave da OpenAI configurada.", 503);
  }
  const isOwnKey = Boolean(organizationOpenAiKey);

  const voiceCallId = randomUUID();
  if (!isOwnKey) {
    const { hasBalance } = await chargeVoiceMinute({ organizationId, userId, voiceCallId, minuteNumber: 1 });
    if (!hasBalance) {
      return errorResponse("NO_BALANCE", "Saldo de Stars insuficiente para conversar por voz.", 402);
    }
  }

  const requestBody = (await request.json().catch(() => ({}))) as { voiceModelId?: unknown };
  const voiceModelId = resolveVoiceModel(typeof requestBody.voiceModelId === "string" ? requestBody.voiceModelId : null);
  const userFirstName = sessionData.user.name?.split(" ")[0] || "você";
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 120 },
      session: buildVoiceSessionConfig({ userFirstName, organizationName: organization?.name ?? "sua empresa", modelId: voiceModelId }),
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    console.error("[astro/voice] client_secrets falhou:", response.status, responseText.slice(0, 400));
    // Chave da empresa recusada: avisa em vez de cair na da plataforma, que cobraria sem o usuário saber (CB-5).
    return isOwnKey
      ? errorResponse("OWN_KEY_REJECTED", "Sua chave da OpenAI recusou a conexão de voz. Confira em Satélites.", 502)
      : errorResponse("VOICE_UNAVAILABLE", "Não consegui abrir a voz agora. Tente de novo.", 502);
  }

  const clientSecret = (await response.json()) as { value?: string };
  if (!clientSecret.value) {
    return errorResponse("VOICE_UNAVAILABLE", "Não consegui abrir a voz agora. Tente de novo.", 502);
  }

  registerCallStart(userId);
  return NextResponse.json({
    clientSecret: clientSecret.value,
    model: voiceModelId,
    callToken: signVoiceCallToken({ voiceCallId, userId, organizationId, isOwnKey, startedAt: Date.now(), modelId: voiceModelId }),
    maxDurationMs: VOICE_CALL_MAX_MS,
    isOwnKey,
  });
}
