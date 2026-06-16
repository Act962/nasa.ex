/**
 * Narrowing das colunas Uazapi de `WhatsAppInstance` que viraram nullable
 * quando o provider passou a ser escolhido na criação da instância
 * (`instanceId`/`apiKey`/`baseUrl`).
 *
 * - `provider == UAZAPI`  → essas colunas estão SEMPRE preenchidas.
 * - `provider == META_CLOUD` → ficam NULL (não há instância Uazapi por trás).
 *
 * Todo code-path que fala HTTP com a Uazapi precisa narrowar `string | null`
 * pra `string` antes de usar. Estes helpers fazem isso lançando um erro claro
 * (`UazapiCredentialsMissingError`) em vez de deixar um `null` vazar pro client
 * Uazapi e estourar um erro genérico mais embaixo. São funções puras — sem
 * dependência de servidor — então podem ser importadas em qualquer camada.
 */

export class UazapiCredentialsMissingError extends Error {
  constructor(field: "apiKey" | "baseUrl" | "instanceId") {
    super(
      `WhatsAppInstance sem credencial Uazapi "${field}". Provavelmente é uma ` +
        `instância META_CLOUD — use o provider correto (resolveOutboundProvider) ` +
        `em vez de falar com a Uazapi diretamente.`,
    );
    this.name = "UazapiCredentialsMissingError";
  }
}

/** Narrows the nullable Uazapi token (`apiKey`); throws if absent. */
export function requireUazapiToken(apiKey: string | null | undefined): string {
  if (!apiKey) throw new UazapiCredentialsMissingError("apiKey");
  return apiKey;
}

/** Narrows the nullable Uazapi base URL; throws if absent. */
export function requireUazapiBaseUrl(baseUrl: string | null | undefined): string {
  if (!baseUrl) throw new UazapiCredentialsMissingError("baseUrl");
  return baseUrl;
}

/** Narrows the nullable Uazapi instance id; throws if absent. */
export function requireUazapiInstanceId(
  instanceId: string | null | undefined,
): string {
  if (!instanceId) throw new UazapiCredentialsMissingError("instanceId");
  return instanceId;
}
