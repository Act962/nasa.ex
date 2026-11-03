import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";

// Avisos do banco (spec 0130, D-4, RNF-4; spec 0133, D-4): PIX pago (`{ pix: [...] }`) ou
// boleto emitido/pago/cancelado/expirado (lista de cobranças). Não confia no corpo: só confere o
// token da URL, a conta e a origem, e enfileira. Tudo é conferido no banco pela função
// `payment-bank-pix-received`. O Inter acrescenta `/pix` à URL cadastrada, daí o `suffix`.

export const dynamic = "force-dynamic";

const MAX_PIX_PER_NOTICE = 100;

interface RouteParams {
  params: Promise<{ connectionId: string; token: string; suffix?: string[] }>;
}

interface PixNoticeItem {
  endToEndId?: unknown;
}

interface BoletoNoticeItem {
  codigoSolicitacao?: unknown;
  situacao?: unknown;
}

const BANK_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

function isSameSecret(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

/** Lista opcional de IPs do banco (`BANK_WEBHOOK_ALLOWED_IPS`, separados por vírgula). */
function isAllowedOrigin(request: NextRequest): boolean {
  const allowedIps = process.env.BANK_WEBHOOK_ALLOWED_IPS?.split(",").map((ip) => ip.trim()).filter(Boolean);
  if (!allowedIps?.length) return true;
  const clientIp =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return allowedIps.includes(clientIp);
}

function readBoletoNotices(body: unknown): Array<{ requestId: string; situation: string }> {
  if (!Array.isArray(body)) return [];
  return body
    .map((item: BoletoNoticeItem) => ({
      requestId: typeof item?.codigoSolicitacao === "string" ? item.codigoSolicitacao : "",
      situation: typeof item?.situacao === "string" ? item.situacao : "AVISO",
    }))
    .filter((notice) => BANK_ID_PATTERN.test(notice.requestId) && BANK_ID_PATTERN.test(notice.situation))
    .slice(0, MAX_PIX_PER_NOTICE);
}

function readEndToEndIds(body: unknown): string[] {
  const items = (body as { pix?: unknown })?.pix;
  if (!Array.isArray(items)) return [];
  return items
    .map((item: PixNoticeItem) => (typeof item?.endToEndId === "string" ? item.endToEndId : null))
    .filter((endToEndId): endToEndId is string => Boolean(endToEndId && /^[A-Za-z0-9]{1,35}$/.test(endToEndId)))
    .slice(0, MAX_PIX_PER_NOTICE);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { connectionId, token } = await params;
  const connection = await prisma.paymentBankConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, organizationId: true, webhookToken: true, accountNumber: true },
  });
  if (!connection || !isSameSecret(token, connection.webhookToken)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Aviso que não é nosso: 200 sem processar, para o banco não insistir e sem revelar nada.
  const accountHeader = request.headers.get("x-conta-corrente")?.replace(/\D/g, "");
  if (!isAllowedOrigin(request) || (accountHeader && connection.accountNumber && accountHeader !== connection.accountNumber)) {
    console.warn("[bank-webhook] notice ignored", { connectionId });
    return NextResponse.json({ ok: true });
  }

  const body: unknown = await request.json().catch(() => null);
  const pixEvents = readEndToEndIds(body).map((endToEndId) => ({
    name: "payment/bank-pix.received",
    id: `bank-pix-${connection.id}-${endToEndId}`,
    data: { organizationId: connection.organizationId, connectionId: connection.id, endToEndId },
  }));
  const boletoEvents = readBoletoNotices(body).map((notice) => ({
    name: "payment/bank-boleto.updated",
    id: `bank-boleto-${connection.id}-${notice.requestId}-${notice.situation}`,
    data: { organizationId: connection.organizationId, connectionId: connection.id, boletoRequestId: notice.requestId },
  }));
  const events = [...pixEvents, ...boletoEvents];
  if (events.length > 0) await inngest.send(events);
  return NextResponse.json({ ok: true });
}
