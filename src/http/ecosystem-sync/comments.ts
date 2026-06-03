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
 * Sincronização entre ecossistemas — alvo: comments-app.
 * Cliente OUTBOUND do sync de auth NASA → comments-app.
 *
 * Espelho de `src/http/sync-nerp/client.ts`: assina com a MESMA credencial de
 * SISTEMA (`SYNC_SHARED_SECRET` / `SYNC_API_KEY`) usada com o NERP — uma única
 * identidade "NASA sistema". Aponta para o endpoint inbound do comments
 * (base + `/api/sync/nasa`). A base vem de `COMMENTS_APP_BASE_URL` (mesma usada
 * por `src/http/comments/client.ts`); `COMMENTS_SYNC_BASE_URL` é override opcional.
 *
 * Distinto da integração de PRODUTO por-org (`src/http/comments`, headers
 * `x-comments-*` sobre `CommentsIntegrationKey`): aqui o canal é nível-sistema.
 */

const INBOUND_PATH = "/api/sync/nasa";
const TIMEOUT_MS = Number(process.env.SYNC_REQUEST_TIMEOUT_MS ?? 10_000);

function resolveBaseUrl(): string {
  const baseUrl = process.env.COMMENTS_APP_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "Missing env COMMENTS_APP_BASE_URL (ou COMMENTS_SYNC_BASE_URL)",
    );
  }
  return baseUrl.replace(/\/$/, "");
}

async function postSyncEntity(type: SyncType, data: unknown): Promise<void> {
  const body = JSON.stringify({ type, data });
  const headers = buildSyncHeaders({
    method: "POST",
    path: INBOUND_PATH,
    body,
  });

  const response = await fetch(`${resolveBaseUrl()}${INBOUND_PATH}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    // Lança para a função Inngest fazer retry/backoff.
    throw new Error(
      `sync→comments ${type} failed: HTTP ${response.status} ${responseText}`,
    );
  }
}

export const ecosystemSyncComments = {
  upsertUser: (data: SyncUserPayload) => postSyncEntity("user", data),
  upsertAccount: (data: SyncAccountPayload) => postSyncEntity("account", data),
  upsertOrg: (data: SyncOrgPayload) => postSyncEntity("org", data),
  upsertMember: (data: SyncMemberPayload) => postSyncEntity("member", data),
};
