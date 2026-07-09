import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import type { FocusNfseErro, FocusNfseStatus } from "@/http/focus-nfe/types";

export const runtime = "nodejs";

const FOCUS_NFSE_STATUSES: readonly FocusNfseStatus[] = [
  "processando_autorizacao",
  "autorizado",
  "erro_autorizacao",
  "cancelado",
];

function parseWebhookStatus(value: unknown): FocusNfseStatus | null {
  return typeof value === "string" &&
    (FOCUS_NFSE_STATUSES as readonly string[]).includes(value)
    ? (value as FocusNfseStatus)
    : null;
}

function parseWebhookErros(value: unknown): FocusNfseErro[] | null {
  if (!Array.isArray(value)) return null;
  const erros = value.flatMap((erro) => {
    if (typeof erro !== "object" || erro === null) return [];
    const { codigo, mensagem, correcao } = erro as Record<string, unknown>;
    if (typeof mensagem !== "string") return [];
    return [
      {
        codigo: typeof codigo === "string" ? codigo : null,
        mensagem,
        correcao: typeof correcao === "string" ? correcao : null,
      } satisfies FocusNfseErro,
    ];
  });
  return erros.length > 0 ? erros : null;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.FOCUS_NFE_WEBHOOK_SECRET;
  const secretParam = req.nextUrl.searchParams.get("secret-key");

  if (!webhookSecret || secretParam !== webhookSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ref = typeof body.ref === "string" ? body.ref : null;
  if (!ref) {
    return NextResponse.json({ ok: true });
  }

  const status = parseWebhookStatus(body.status);
  const erros = parseWebhookErros(body.erros);
  const webhookErrorMessages =
    status === "erro_autorizacao" && erros?.length
      ? erros.map((erro) => erro.mensagem)
      : null;

  try {
    await inngest.send({
      name: "fiscal/nfse.status-changed",
      data: {
        gateway: "FOCUS_NFE",
        ref,
        externalId: null,
        webhookErrorMessages,
      },
    });
  } catch (err) {
    console.error("[focus-nfe/webhook] failed to dispatch inngest event", err);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
