import "dotenv/config";
import { buildSyncHeaders } from "@/features/sync/lib/system-cred";
import type {
  SyncAccountPayload,
  SyncMemberPayload,
  SyncOrgPayload,
  SyncType,
  SyncUserPayload,
} from "@/features/sync/lib/payloads";

/**
 * Cliente OUTBOUND do sync de auth: NASA → NERP.
 *
 * Espelho de `src/http/nerp/client.ts`, mas assina com a credencial de SISTEMA
 * (`SYNC_SHARED_SECRET` / `SYNC_API_KEY`) em vez do consent por-org. Aponta
 * para o endpoint inbound do NERP (base + `/api/sync/nasa`). A base vem de
 * `NERP_BASE_URL` (mesma do NERP); `NERP_SYNC_BASE_URL` é override opcional.
 */

const INBOUND_PATH = "/api/sync/nasa";
const TIMEOUT_MS = Number(process.env.SYNC_REQUEST_TIMEOUT_MS ?? 10_000);

function baseUrl(): string {
  const b = process.env.NERP_SYNC_BASE_URL ?? process.env.NERP_BASE_URL;
  if (!b) {
    throw new Error("Missing env NERP_BASE_URL (ou NERP_SYNC_BASE_URL)");
  }
  return b.replace(/\/$/, "");
}

async function send(type: SyncType, data: unknown): Promise<void> {
  const body = JSON.stringify({ type, data });
  const headers = buildSyncHeaders({
    method: "POST",
    path: INBOUND_PATH,
    body,
  });

  const res = await fetch(`${baseUrl()}${INBOUND_PATH}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Lança para a função Inngest fazer retry/backoff.
    throw new Error(`sync→nerp ${type} failed: HTTP ${res.status} ${text}`);
  }
}

export const syncNerpClient = {
  upsertUser: (data: SyncUserPayload) => send("user", data),
  upsertAccount: (data: SyncAccountPayload) => send("account", data),
  upsertOrg: (data: SyncOrgPayload) => send("org", data),
  upsertMember: (data: SyncMemberPayload) => send("member", data),
};
