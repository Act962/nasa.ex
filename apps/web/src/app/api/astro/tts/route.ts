/**
 * Proxy pra Piper TTS HTTP local.
 *
 * Cliente posta { text, voice?, ... } → Next.js encaminha pro container
 * Piper (PIPER_HTTP_URL, default http://localhost:10200) → devolve
 * audio/wav.
 *
 * Por que proxy em vez de cliente bater direto?
 *   - CORS: o container Piper está em port :10200, evita tunar CORS lá.
 *   - Cache: posso adicionar cache em disco/Redis aqui sem mudar o
 *     container.
 *   - Failover: posso detectar Piper down e responder 503 amigável que
 *     o cliente entende como "fallback pro Web Speech".
 *   - Auth: posso amarrar autenticação do usuário antes de chamar TTS
 *     (next session — hoje qualquer um chama, mas só tem efeito no
 *     próprio browser).
 *
 * GET /api/astro/tts/health → checa se Piper tá UP (cliente usa pra
 * decidir se usa Piper ou Web Speech como fallback).
 */

import { NextResponse } from "next/server";

const PIPER_URL = process.env.PIPER_HTTP_URL ?? "http://localhost:10200";

interface TtsBody {
  text?: unknown;
  voice?: unknown;
  length_scale?: unknown;
  noise_scale?: unknown;
  noise_w?: unknown;
}

export async function POST(req: Request) {
  let body: TtsBody;
  try {
    body = (await req.json()) as TtsBody;
  } catch {
    return NextResponse.json(
      { error: "Body inválido (esperado JSON)" },
      { status: 400 },
    );
  }

  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json(
      { error: "Campo 'text' obrigatório (string não-vazia)" },
      { status: 400 },
    );
  }
  if (body.text.length > 2000) {
    return NextResponse.json(
      { error: "Texto longo demais (max 2000 chars)" },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = { text: body.text };
  if (typeof body.voice === "string") payload.voice = body.voice;
  if (typeof body.length_scale === "number")
    payload.length_scale = body.length_scale;
  if (typeof body.noise_scale === "number")
    payload.noise_scale = body.noise_scale;
  if (typeof body.noise_w === "number") payload.noise_w = body.noise_w;

  try {
    const upstream = await fetch(`${PIPER_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // 30s — Piper inferência em CPU pode levar até 2s pra frases longas
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        { error: "Piper retornou erro", detail, status: upstream.status },
        { status: 502 },
      );
    }

    const audioBytes = await upstream.arrayBuffer();
    return new NextResponse(audioBytes, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "X-Voice": upstream.headers.get("X-Voice") ?? "unknown",
      },
    });
  } catch (err) {
    // Falha de rede = Piper down. Cliente trata como sinal pra fallback Web Speech.
    return NextResponse.json(
      {
        error: "Piper offline",
        hint:
          "Rode `docker compose up piper -d` ou desabilite NEXT_PUBLIC_PIPER_ENABLED",
        cause: err instanceof Error ? err.message : "unknown",
      },
      { status: 503 },
    );
  }
}

export async function GET() {
  try {
    const r = await fetch(`${PIPER_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!r.ok) {
      return NextResponse.json({ status: "down" }, { status: 503 });
    }
    const data = await r.json();
    return NextResponse.json({ status: "up", ...data });
  } catch {
    return NextResponse.json({ status: "down" }, { status: 503 });
  }
}
