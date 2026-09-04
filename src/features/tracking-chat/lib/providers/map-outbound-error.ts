import "server-only";
import { ORPCError } from "@orpc/server";
import {
  resolveOutboundProvider,
  type ResolvedOutboundProvider,
} from "./resolve-outbound-provider";
import {
  MetaCredentialsIncompleteError,
  MetaFeatureUnsupportedError,
  OutboundProviderError,
  ProviderFeatureUnsupportedError,
  ProviderSendInvalidResponseError,
} from "./outbound-errors";

/**
 * Traduz os erros de domínio do outbound (`OutboundProviderError` e
 * subclasses) pro erro oRPC que o frontend consegue tratar (spec 0010,
 * RF-3/RF-4/RF-5).
 *
 * Antes, `resolveOutboundProvider` e `provider.send*` lançavam cru em 13
 * dos 15 call-sites: o erro virava 500 e o chat mostrava o
 * `toast.error("Erro ao enviar mensagem")` genérico. Quem não tinha
 * instância configurada recebia a mesma mensagem de quem teve timeout de
 * rede — sem nada acionável.
 *
 * O helper **devolve** o erro em vez de lançar (call-site escreve
 * `throw mapOutboundError(error)`), o que mantém o fluxo de controle
 * explícito no handler e deixa a função testável sem montar contexto
 * oRPC. Erro que não é do domínio outbound volta intacto — nada vira
 * `BAD_REQUEST` por engano.
 *
 * Segue o padrão de `router/comments/_errors.ts`: `ORPCError` direto em
 * vez do `errors.BAD_REQUEST` do handler, porque o error map do projeto
 * não declara schema de `data` e forçaria `as never` em cada site.
 */

export interface OutboundErrorPayload {
  readonly message: string;
  readonly data: {
    /** Código semântico — o que o frontend usa pra escolher a UI. */
    readonly code: string;
    /** Feature recusada, em `META_FEATURE_UNSUPPORTED`/`PROVIDER_FEATURE_UNSUPPORTED`. */
    readonly feature?: string;
    /** Credenciais faltando, em `META_CREDENTIALS_INCOMPLETE`. */
    readonly fields?: readonly string[];
    /** Provider ativo, quando o erro é específico dele. */
    readonly providerId?: string;
  };
}

/**
 * Extrai o payload estruturado de um erro de outbound. Devolve `null`
 * quando o erro não pertence ao domínio — o caller decide o que fazer.
 *
 * Usado direto pelo `forward`, que reporta falha **por destino** dentro
 * do array de resultados em vez de derrubar a requisição inteira
 * (spec 0010, RF-6/CB-8).
 */
export function toOutboundErrorPayload(
  error: unknown,
): OutboundErrorPayload | null {
  if (!(error instanceof OutboundProviderError)) return null;

  if (error instanceof MetaCredentialsIncompleteError) {
    return {
      message: error.message,
      data: { code: error.code, fields: error.fields },
    };
  }

  if (error instanceof MetaFeatureUnsupportedError) {
    return {
      message: error.message,
      data: { code: error.code, feature: error.feature },
    };
  }

  if (error instanceof ProviderFeatureUnsupportedError) {
    return {
      message: error.message,
      data: {
        code: error.code,
        feature: error.feature,
        providerId: error.providerId,
      },
    };
  }

  if (error instanceof ProviderSendInvalidResponseError) {
    return {
      message: error.message,
      data: { code: error.code, providerId: error.providerId },
    };
  }

  // `InstanceNotFoundError`, `OutboundWindowClosedError` e qualquer
  // subclasse futura: o `code` sozinho já basta pro frontend ramificar.
  return { message: error.message, data: { code: error.code } };
}

/**
 * Converte um erro de outbound em `ORPCError("BAD_REQUEST")` com
 * `data.code`. Erros de outra natureza voltam inalterados, preservando o
 * comportamento atual (spec 0010, CA-6).
 *
 * ```ts
 * try {
 *   resolved = await resolveOutboundProvider(trackingId);
 * } catch (error) {
 *   throw mapOutboundError(error);
 * }
 * ```
 */
export function mapOutboundError(error: unknown): unknown {
  const payload = toOutboundErrorPayload(error);
  if (!payload) return error;

  return new ORPCError("BAD_REQUEST", {
    message: payload.message,
    data: payload.data,
  });
}

/**
 * `resolveOutboundProvider` já embrulhado pro transporte oRPC — é o que
 * os handlers devem chamar.
 *
 * Existe porque o try/catch de mapeamento era idêntico nos 15 call-sites
 * e fácil de esquecer num handler novo (foi exatamente o que aconteceu:
 * só `create-template.ts` mapeava). Concentrando aqui, o handler chama
 * uma função e ganha o erro estruturado de graça.
 *
 * Use `resolveOutboundProvider` cru apenas fora de handler oRPC — em
 * webhook, rota REST ou job Inngest, onde `ORPCError` não faz sentido.
 */
export async function resolveOutboundProviderOrBadRequest(
  trackingId: string,
): Promise<ResolvedOutboundProvider> {
  try {
    return await resolveOutboundProvider(trackingId);
  } catch (error) {
    throw mapOutboundError(error);
  }
}
