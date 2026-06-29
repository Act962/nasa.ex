import "dotenv/config";
import type { MetaApiError } from "./types";

const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com/v23.0";

function getGraphBaseUrl(override?: string): string {
  return (
    override ||
    process.env.WHATSAPP_OFICIAL_GRAPH_BASE_URL ||
    DEFAULT_GRAPH_BASE_URL
  );
}

interface GraphRequestOptions extends Omit<RequestInit, "body"> {
  accessToken: string;
  baseUrl?: string;
  body?: unknown;
}

export async function graphFetch<T>(
  path: string,
  options: GraphRequestOptions,
): Promise<T> {
  const { accessToken, baseUrl, body, headers, ...rest } = options;

  const url = `${getGraphBaseUrl(baseUrl)}${path}`;

  const response = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw await buildMetaError(response);
  }

  return response.json() as Promise<T>;
}

interface GraphMultipartRequestOptions
  extends Omit<RequestInit, "body" | "headers"> {
  accessToken: string;
  baseUrl?: string;
  formData: FormData;
  extraHeaders?: HeadersInit;
}

export async function graphFetchMultipart<T>(
  path: string,
  options: GraphMultipartRequestOptions,
): Promise<T> {
  const { accessToken, baseUrl, formData, extraHeaders, ...rest } = options;

  const url = `${getGraphBaseUrl(baseUrl)}${path}`;

  const response = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders,
    },
    body: formData,
  });

  if (!response.ok) {
    throw await buildMetaError(response);
  }

  return response.json() as Promise<T>;
}

export async function graphFetchBinary(
  fullUrl: string,
  accessToken: string,
): Promise<{ buffer: Buffer; mimetype: string }> {
  const response = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw await buildMetaError(response);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimetype =
    response.headers.get("content-type") || "application/octet-stream";
  return { buffer: Buffer.from(arrayBuffer), mimetype };
}

async function buildMetaError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as
    | MetaApiError
    | null;

  const metaError = payload?.error;
  const fbtrace = metaError?.fbtrace_id ? ` (fbtrace=${metaError.fbtrace_id})` : "";
  const code = metaError?.code !== undefined ? ` code=${metaError.code}` : "";
  const subcode =
    metaError?.error_subcode !== undefined
      ? ` subcode=${metaError.error_subcode}`
      : "";

  const message =
    metaError?.message ||
    `WhatsApp Oficial error: ${response.status} ${response.statusText}.`;

  const error = new Error(
    `${message}${code}${subcode}${fbtrace} (status ${response.status})`,
  );
  (error as Error & { metaError?: MetaApiError["error"] }).metaError =
    metaError ?? undefined;
  return error;
}
