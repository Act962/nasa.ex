import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { getNfeIoClient, getNfeIoWebhookSecret } from "@/lib/nfe-io";
import { nfeIoWebhookEventToFlowStatus } from "@/features/fiscal/lib/gateways";

export const runtime = "nodejs";

// Shape real do corpo (confirmado em 2026-07-09):
//   { "action": "issued_successfully",
//     "payload": { "externalId": "forge-...", "flowStatus": "Issued", ... } }
// O `action` vem em forma curta (sem o prefixo "service_invoice." dos filtros)
// e o resto fica aninhado em `payload`. Como a NFE.io não garante esse formato
// e ele já mudou antes, varremos o payload inteiro atrás dos sinais: o nome do
// evento (validado contra o mapa conhecido) e o externalId (nossa ref única
// `forge-...`). Evento não reconhecido → 200 + log (nunca 4xx/5xx, senão a
// NFE.io desativa o webhook após falhas repetidas).

// Percorre o objeto (profundidade) e retorna o primeiro par (key, valor string)
// que satisfaz o predicado.
function findMatchingString(
  root: unknown,
  predicate: (key: string, value: string) => boolean,
): string | null {
  const stack: Array<{ key: string; value: unknown }> = [
    { key: "", value: root },
  ];
  while (stack.length > 0) {
    const { key, value } = stack.pop()!;
    if (typeof value === "string") {
      if (predicate(key, value)) return value;
    } else if (Array.isArray(value)) {
      for (const item of value) stack.push({ key, value: item });
    } else if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value))
        stack.push({ key: childKey, value: childValue });
    }
  }
  return null;
}

function extractEventName(body: Record<string, unknown>): string | null {
  return findMatchingString(
    body,
    (_key, value) => nfeIoWebhookEventToFlowStatus(value) !== null,
  );
}

// Nosso ref `forge-...` — a NFE.io o ecoa em `payload.externalId`. No banco ele
// é a coluna `ref` (NÃO a `externalId`, que guarda o id interno da NFE.io).
function extractForgeRef(body: Record<string, unknown>): string | null {
  return findMatchingString(
    body,
    (key, value) =>
      /^external_?id$/i.test(key) || value.startsWith("forge-"),
  );
}

// Id interno da nota na NFE.io (`payload.id`) — corresponde à coluna `externalId`
// no banco. Fica na raiz de `payload`, não nos objetos aninhados (provider/borrower).
function extractNfeIoInvoiceId(body: Record<string, unknown>): string | null {
  const payload = body.payload;
  if (!payload || typeof payload !== "object") return null;
  const invoiceId = (payload as Record<string, unknown>).id;
  return typeof invoiceId === "string" ? invoiceId : null;
}

function extractErrorMessages(body: Record<string, unknown>): string[] | null {
  const message =
    findMatchingString(
      body,
      (key, value) => /flowmessage/i.test(key) && value.length > 0,
    ) ??
    findMatchingString(
      body,
      (key, value) => /message|error/i.test(key) && value.length > 0,
    );
  return message ? [message] : null;
}

export async function POST(req: NextRequest) {
  // Corpo cru ANTES de qualquer parse — a assinatura é HMAC-SHA1 dos bytes
  // exatos enviados pela NFE.io.
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature") ?? undefined;

  // Ping de verificação na criação do webhook chega com corpo vazio e sem
  // assinatura — precisa responder 2xx ANTES da checagem de assinatura, senão
  // a NFE.io recusa a criação (400) por não receber 2xx no ping.
  if (!rawBody.trim()) {
    return NextResponse.json({ ok: true });
  }

  let webhookSecret: string;
  try {
    webhookSecret = getNfeIoWebhookSecret();
  } catch (err) {
    console.error("[nfe-io/webhook] segredo não configurado", err);
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const isValidSignature = getNfeIoClient().webhooks.validateSignature(
    rawBody,
    signature,
    webhookSecret,
  );
  if (!isValidSignature) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const eventName = extractEventName(body);
  // `forgeRef` casa com a coluna `ref`; `nfeIoInvoiceId` casa com `externalId`.
  // O Inngest correlaciona por qualquer um dos dois (ref tem prioridade).
  const forgeRef = extractForgeRef(body);
  const nfeIoInvoiceId = extractNfeIoInvoiceId(body);
  const flowStatus = nfeIoWebhookEventToFlowStatus(eventName);

  if ((!forgeRef && !nfeIoInvoiceId) || !flowStatus) {
    // Sem PII no log: só os sinais de correlação e as chaves de topo. Evento
    // não reconhecido (ex.: novo tipo de action) → 200 para não ser desativado.
    console.warn("[nfe-io/webhook] evento não correlacionável, ignorando", {
      eventName,
      forgeRef,
      nfeIoInvoiceId,
      action: typeof body.action === "string" ? body.action : null,
      bodyKeys: Object.keys(body),
    });
    return NextResponse.json({ ok: true });
  }

  const isFailureEvent =
    flowStatus === "IssueFailed" || flowStatus === "CancelFailed";
  const errorMessages = extractErrorMessages(body);

  try {
    await inngest.send({
      name: "fiscal/nfse.status-changed",
      data: {
        gateway: "NFE_IO",
        ref: forgeRef,
        externalId: nfeIoInvoiceId,
        webhookErrorMessages: isFailureEvent
          ? (errorMessages ?? ["Erro desconhecido"])
          : null,
      },
    });
  } catch (err) {
    console.error("[nfe-io/webhook] failed to dispatch inngest event", err);
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
