import "server-only";
import { request } from "node:https";
import type {
  InterAppCredentials,
  InterCallContext,
  InterEnv,
  InterMtlsCredentials,
  InterProblem,
  InterTokenResponse,
} from "./types";

// Cliente fino da API PJ do Inter (spec 0130). Toda chamada exige mTLS com o certificado
// da integração; ele é montado em memória por chamada, nunca gravado em disco (regra 24a).
// Só pode rodar no servidor da aplicação: o Inter recusa IP dinâmico com 406 (RNF-10).

const INTER_BASE_URL: Record<InterEnv, string> = {
  production: "https://cdpj.partners.bancointer.com.br",
  sandbox: "https://cdpj-sandbox.partners.uatinter.co",
};

const DEFAULT_TIMEOUT_MS = 10_000;

export class InterApiError extends Error {
  readonly status: number;
  readonly problem: InterProblem | null;

  constructor(status: number, problem: InterProblem | null) {
    super(describeInterError(status, problem));
    this.name = "InterApiError";
    this.status = status;
    this.problem = problem;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

function describeInterError(status: number, problem: InterProblem | null): string {
  const reasons = problem?.violacoes
    ?.map((violation) => [violation.propriedade, violation.razao].filter(Boolean).join(": "))
    .filter(Boolean)
    .join("; ");
  const detail = reasons || problem?.detail || problem?.title;
  switch (status) {
    case 400:
      return `O Inter recusou os dados enviados${detail ? `: ${detail}` : "."}`;
    case 401:
      return "O Inter não aceitou as credenciais. Confira o client_id, o client_secret e o certificado.";
    case 403:
      return "A integração do Inter não tem permissão para esta operação (escopo ausente).";
    case 404:
      return "O Inter não encontrou o registro pedido.";
    case 406:
      return "O Inter bloqueou a origem da chamada (IP não liberado).";
    case 429:
      return "Limite de chamadas do Inter atingido. Tente de novo em instantes.";
    case 503:
      return "O Inter está fora do ar ou fora da janela de funcionamento.";
    default:
      return `Erro ${status} do Inter${detail ? `: ${detail}` : "."}`;
  }
}

interface RawResponse {
  status: number;
  bodyText: string;
}

function sendHttpsRequest(params: {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: string;
  mtls: InterMtlsCredentials;
  timeoutMs: number;
}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      params.url,
      {
        method: params.method,
        headers: params.headers,
        cert: params.mtls.certificatePem,
        key: params.mtls.privateKeyPem,
        timeout: params.timeoutMs,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () =>
          resolve({ status: incoming.statusCode ?? 0, bodyText: Buffer.concat(chunks).toString("utf8") }),
        );
        incoming.on("error", reject);
      },
    );
    outgoing.on("timeout", () => outgoing.destroy(new Error(`Inter não respondeu em ${params.timeoutMs} ms.`)));
    outgoing.on("error", reject);
    if (params.body !== undefined) outgoing.write(params.body);
    outgoing.end();
  });
}

function parseProblem(bodyText: string): InterProblem | null {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText) as InterProblem;
  } catch {
    return { detail: bodyText.slice(0, 200) };
  }
}

/** Pede um token OAuth (client_credentials). O Inter aceita só 5 pedidos por minuto. */
export async function requestInterToken(
  credentials: InterAppCredentials,
  scopes: readonly string[],
): Promise<InterTokenResponse> {
  const form = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    grant_type: "client_credentials",
    scope: scopes.join(" "),
  }).toString();

  const response = await sendHttpsRequest({
    url: new URL("/oauth/v2/token", INTER_BASE_URL[credentials.env]),
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(form)),
    },
    body: form,
    mtls: credentials,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  if (response.status !== 200) throw new InterApiError(response.status, parseProblem(response.bodyText));
  return JSON.parse(response.bodyText) as InterTokenResponse;
}

/** Chamada autenticada. Devolve `null` quando o Inter responde sem corpo (204). */
export async function interRequest<T>(
  context: InterCallContext,
  params: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  },
): Promise<T | null> {
  const url = new URL(params.path, INTER_BASE_URL[context.env]);
  for (const [name, value] of Object.entries(params.query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }

  const bodyText = params.body === undefined ? undefined : JSON.stringify(params.body);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${context.accessToken}`,
  };
  if (bodyText !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(bodyText));
  }
  if (context.accountNumber) headers["x-conta-corrente"] = context.accountNumber;

  const response = await sendHttpsRequest({
    url,
    method: params.method,
    headers,
    body: bodyText,
    mtls: context,
    timeoutMs: context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new InterApiError(response.status, parseProblem(response.bodyText));
  }
  return response.bodyText ? (JSON.parse(response.bodyText) as T) : null;
}
