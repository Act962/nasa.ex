"use server";
import type {
  MetaApiError,
  ResumableUploadFileResponse,
  ResumableUploadSessionResponse,
} from "./types";

const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com/v23.0";

function getGraphBaseUrl(override?: string): string {
  return (
    override ||
    process.env.WHATSAPP_OFICIAL_GRAPH_BASE_URL ||
    DEFAULT_GRAPH_BASE_URL
  );
}

interface UploadResumableMediaInput {
  /** App ID Meta (`META_APP_ID`). */
  appId: string;
  /** App access token (`{app_id}|{app_secret}`). */
  appAccessToken: string;
  file: Buffer;
  mimetype: string;
  filename: string;
  baseUrl?: string;
}

/**
 * Sobe uma **amostra de mídia** para o header de um template via Resumable
 * Upload API e devolve o `header_handle` — o único jeito de referenciar mídia
 * na CRIAÇÃO de um template (`example.header_handle`).
 *
 * Fluxo em 2 passos (ambos no nó do App, autenticados com `OAuth {app_token}`):
 *   1. `POST /{app_id}/uploads?file_name&file_length&file_type` → sessão `upload:...`
 *   2. `POST /{upload_session_id}` (bytes crus, `file_offset: 0`) → `{ h }`
 *
 * Não usa `graphFetch` porque o header é `Authorization: OAuth` (não `Bearer`)
 * e o body do 2º passo é binário cru.
 *
 * Ref: https://developers.facebook.com/docs/graph-api/guides/upload
 */
export async function uploadResumableMedia(
  input: UploadResumableMediaInput,
): Promise<{ handle: string }> {
  const baseUrl = getGraphBaseUrl(input.baseUrl);
  const authorization = `OAuth ${input.appAccessToken}`;

  const sessionParams = new URLSearchParams({
    file_name: input.filename,
    file_length: String(input.file.byteLength),
    file_type: input.mimetype,
  });

  const sessionResponse = await fetch(
    `${baseUrl}/${input.appId}/uploads?${sessionParams.toString()}`,
    { method: "POST", headers: { Authorization: authorization } },
  );
  if (!sessionResponse.ok) {
    throw await buildResumableError(sessionResponse, "criar sessão de upload");
  }
  const session =
    (await sessionResponse.json()) as ResumableUploadSessionResponse;

  const fileResponse = await fetch(`${baseUrl}/${session.id}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: new Uint8Array(input.file),
  });
  if (!fileResponse.ok) {
    throw await buildResumableError(fileResponse, "enviar amostra de mídia");
  }
  const uploaded = (await fileResponse.json()) as ResumableUploadFileResponse;

  if (!uploaded.h) {
    throw new Error("Resumable upload não retornou header handle.");
  }
  return { handle: uploaded.h };
}

async function buildResumableError(
  response: Response,
  step: string,
): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as
    | MetaApiError
    | null;
  const message =
    payload?.error?.message ||
    `${response.status} ${response.statusText}`;
  return new Error(`Falha ao ${step} (mídia do template): ${message}`);
}
