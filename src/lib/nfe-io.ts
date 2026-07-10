/**
 * NFE.io client — NASA Platform (lazy initialization)
 *
 * Singleton do SDK oficial `nfe-io` (v5) usado pelo gateway fiscal NFE_IO
 * (src/features/fiscal/lib/gateways/adapters/nfe-io). Criado sob demanda para
 * que a ausência de NFE_IO_API_KEY não quebre o boot em dev.
 *
 * Env vars:
 *   NFE_IO_API_KEY        — API key da conta NFE.io
 *   NFE_IO_WEBHOOK_SECRET — segredo (32–64 chars) do HMAC-SHA1 do webhook
 */

import { NfeClient } from "nfe-io";

const NFE_IO_TIMEOUT_MS = 30_000;

const globalForNfeIo = global as unknown as {
  _nfeIoClient: NfeClient | undefined;
};

export function getNfeIoClient(): NfeClient {
  if (globalForNfeIo._nfeIoClient) return globalForNfeIo._nfeIoClient;

  const apiKey = process.env.NFE_IO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NFE_IO_API_KEY não configurada. Adicione ao .env.local para habilitar a emissão de NFS-e via NFE.io.",
    );
  }

  const client = new NfeClient({ apiKey, timeout: NFE_IO_TIMEOUT_MS });

  if (process.env.NODE_ENV !== "production") {
    globalForNfeIo._nfeIoClient = client;
  }

  return client;
}

// A NFE.io devolve o motivo real da recusa no corpo do erro, em formatos
// variados conforme o endpoint: string cru, `{ message }`, `{ errors: [...] }`
// (v1) ou `{ errors: { campo: [...] } }` (validação ASP.NET). Extrai uma
// mensagem legível de qualquer um deles, sem despejar o objeto cru.
export function describeNfeIoError(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details;

  const body = details as Record<string, unknown>;
  const messages: string[] = [];

  if (typeof body.message === "string") messages.push(body.message);

  const errorsField = body.errors;
  if (Array.isArray(errorsField)) {
    for (const entry of errorsField) {
      if (typeof entry === "string") messages.push(entry);
      else if (entry && typeof entry === "object") {
        const errorEntry = entry as Record<string, unknown>;
        const text = errorEntry.message ?? errorEntry.description;
        if (typeof text === "string") messages.push(text);
      }
    }
  } else if (errorsField && typeof errorsField === "object") {
    for (const value of Object.values(errorsField as Record<string, unknown>)) {
      if (typeof value === "string") messages.push(value);
      else if (Array.isArray(value))
        for (const item of value)
          if (typeof item === "string") messages.push(item);
    }
  }

  if (messages.length === 0) {
    try {
      return JSON.stringify(details);
    } catch {
      return null;
    }
  }
  return [...new Set(messages)].join("; ");
}

// Lê status/type/details de um erro da NFE.io sem depender de `instanceof`
// (que é frágil entre realms de módulo do bundler). Todo NfeError expõe essas
// propriedades; NfeIoCertificateUploadError também.
export function extractNfeIoErrorInfo(err: unknown): {
  status?: unknown;
  type?: unknown;
  message: string;
  detail: string | null;
} {
  const errorRecord =
    err && typeof err === "object" ? (err as Record<string, unknown>) : {};
  const details = "details" in errorRecord ? errorRecord.details : undefined;
  return {
    status: errorRecord.status,
    type: errorRecord.type,
    message: err instanceof Error ? err.message : String(err),
    detail: describeNfeIoError(details ?? errorRecord.raw),
  };
}

const NFE_IO_API_BASE_URL = "https://api.nfe.io/v1";

// Erro do upload direto de certificado — carrega status e corpo cru da API para
// o handler descrever o motivo real ao usuário (mesmo shape de `NfeError`).
export class NfeIoCertificateUploadError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(status: number, details: unknown) {
    super(`Falha no upload do certificado na NFE.io (HTTP ${status})`);
    this.name = "NfeIoCertificateUploadError";
    this.status = status;
    this.details = details;
  }
}

// O `companies.uploadCertificate` do SDK v5 anexa o arquivo no campo multipart
// `certificate`, mas a API v1 espera `file` (retorna 400 `errors.file` caso
// contrário) — e o exemplo do SDK passa Buffer cru, que o FormData nativo
// (undici) rejeita. Por isso o upload é feito aqui, direto, com Blob + campo
// `file`, reaproveitando apiKey/base URL do client.
export async function uploadNfeIoCertificate(params: {
  companyId: string;
  fileBase64: string;
  password: string;
  filename?: string;
}): Promise<void> {
  const apiKey = process.env.NFE_IO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NFE_IO_API_KEY não configurada. Adicione ao .env.local para habilitar a emissão de NFS-e via NFE.io.",
    );
  }

  const certificateBytes = Buffer.from(params.fileBase64, "base64");
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([certificateBytes], { type: "application/x-pkcs12" }),
    params.filename ?? "certificado.pfx",
  );
  formData.append("password", params.password);

  const response = await fetch(
    `${NFE_IO_API_BASE_URL}/companies/${params.companyId}/certificate`,
    {
      method: "POST",
      headers: { "X-NFE-APIKEY": apiKey, Accept: "application/json" },
      body: formData,
      signal: AbortSignal.timeout(NFE_IO_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    let details: unknown = responseText;
    try {
      details = JSON.parse(responseText);
    } catch {
      // corpo não-JSON — mantém o texto cru.
    }
    throw new NfeIoCertificateUploadError(response.status, details);
  }
}

// A NFE.io exige que o secret do webhook de conta tenha 32–64 caracteres
// (erro 40001 na criação, caso contrário). `openssl rand -hex 24` = 48 chars.
const NFE_IO_WEBHOOK_SECRET_MIN_LENGTH = 32;
const NFE_IO_WEBHOOK_SECRET_MAX_LENGTH = 64;

export function getNfeIoWebhookSecret(): string {
  const webhookSecret = process.env.NFE_IO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error(
      "NFE_IO_WEBHOOK_SECRET não configurada. Gere com `openssl rand -hex 24` e adicione ao .env.local.",
    );
  }
  if (
    webhookSecret.length < NFE_IO_WEBHOOK_SECRET_MIN_LENGTH ||
    webhookSecret.length > NFE_IO_WEBHOOK_SECRET_MAX_LENGTH
  ) {
    throw new Error(
      `NFE_IO_WEBHOOK_SECRET deve ter entre ${NFE_IO_WEBHOOK_SECRET_MIN_LENGTH} e ${NFE_IO_WEBHOOK_SECRET_MAX_LENGTH} caracteres (atual: ${webhookSecret.length}). Gere com \`openssl rand -hex 24\` (48 chars).`,
    );
  }
  return webhookSecret;
}
