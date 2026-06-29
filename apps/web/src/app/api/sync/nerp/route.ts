import { NextResponse } from "next/server";
import { verifySyncRequest } from "@/features/sync/lib/system-cred";
import { applyInboundSync } from "@/features/sync/lib/inbound";
import type { SyncEnvelope } from "@/features/sync/lib/payloads";

/**
 * Endpoint INBOUND do sync de auth: NERP → NASA.
 *
 * Verifica a assinatura de sistema e delega o upsert ao handler compartilhado
 * `applyInboundSync` (Prisma cru, sem hooks → sem eco; idempotente por id).
 * Respostas: 200 aplicado/skip · 401 assinatura · 409 `{retryable}` FK ausente · 500 `{retryable}`.
 */
export async function POST(request: Request) {
  const isSignatureValid = await verifySyncRequest(request);
  if (!isSignatureValid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let envelope: SyncEnvelope;
  try {
    envelope = (await request.json()) as SyncEnvelope;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const result = await applyInboundSync(envelope, "nerp");
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[sync inbound nerp] upsert failed:", e);
    return NextResponse.json(
      { error: "internal", retryable: true },
      { status: 500 },
    );
  }
}
