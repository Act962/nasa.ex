import { NextResponse } from "next/server";
import { verifySyncRequest } from "@/features/sync/lib/system-cred";
import { applyInboundSync } from "@/features/sync/lib/inbound";
import type { SyncEnvelope } from "@/features/sync/lib/payloads";

/**
 * Endpoint INBOUND do sync de auth: comments-app → NASA.
 *
 * Sentido reverso da `src/http/ecosystem-sync/comments.ts`. Verifica a mesma
 * assinatura de sistema (`SYNC_SHARED_SECRET`/`SYNC_API_KEY`) e delega o upsert
 * ao handler compartilhado `applyInboundSync` (Prisma cru, sem hooks → sem eco).
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
    const result = await applyInboundSync(envelope, "comments");
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[sync inbound comments] upsert failed:", e);
    return NextResponse.json(
      { error: "internal", retryable: true },
      { status: 500 },
    );
  }
}
