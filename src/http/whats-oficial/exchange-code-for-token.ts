"use server";

import type { MetaApiError, OAuthExchangeResponse } from "./types";

const DEFAULT_GRAPH_BASE_URL = "https://graph.facebook.com/v23.0";

function getGraphBaseUrl(override?: string): string {
  return (
    override ||
    process.env.WHATSAPP_OFICIAL_GRAPH_BASE_URL ||
    DEFAULT_GRAPH_BASE_URL
  );
}

interface ExchangeCodeInput {
  code: string;
  clientId: string;
  clientSecret: string;
  /**
   * `redirect_uri` que foi usado na request de autorização (OAuth 2.0).
   * Obrigatório quando o `code` veio do **Hosted Embedded Signup** (link
   * `business.facebook.com/messaging/whatsapp/onboard`) — Meta força
   * match exato. **Opcional** quando o `code` veio do JS SDK (FB.login),
   * porque o SDK não declara redirect_uri explícito.
   */
  redirectUri?: string;
  baseUrl?: string;
}

/**
 * Troca o `code` retornado pelo Embedded Signup por um Business Integration
 * System User Access Token (BISUAT) long-lived, escopado ao cliente.
 *
 * Endpoint Meta (OAuth 2.0):
 *   POST https://graph.facebook.com/v23.0/oauth/access_token
 *   Content-Type: application/json
 *   {
 *     "client_id":     "<APP_ID>",
 *     "client_secret": "<APP_SECRET>",
 *     "code":          "<CODE>",
 *     "grant_type":    "authorization_code",
 *     "redirect_uri":  "<...>"   // só quando aplicável (Hosted ES)
 *   }
 *
 * **Por que POST com JSON (não GET com query):** Meta documenta os dois
 * mas o painel "Trocar token" gera POST como padrão (espelhado em
 * developers.facebook.com/oauth-quickstart). Vantagens:
 *  - `client_secret` NÃO entra na URL — evita vazamento em logs de
 *    proxy/CDN/server que registram a URL completa.
 *  - `grant_type` é parte do padrão OAuth 2.0 e algumas versões da Graph
 *    API rejeitam exchange sem ele.
 *  - Compatível tanto com Tech Provider (`featureType:""`) quanto com
 *    Hosted ES (`featureType:"whatsapp_business_app_onboarding"`).
 *
 * Não usa `graphFetch` porque o endpoint não usa `Authorization: Bearer`
 * (autenticação é via client_id/client_secret no body).
 *
 * O `code` tem TTL de 30s; chamar fora desse intervalo retorna erro 100
 * subcode 33 ("Invalid OAuth access token"). O caller deve disparar essa
 * função IMEDIATAMENTE após receber o code no callback.
 */
export async function exchangeCodeForToken(
  input: ExchangeCodeInput,
): Promise<OAuthExchangeResponse> {
  const url = `${getGraphBaseUrl(input.baseUrl)}/oauth/access_token`;

  const body: Record<string, string> = {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
  };
  if (input.redirectUri) {
    body.redirect_uri = input.redirectUri;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | MetaApiError
      | null;

    const metaError = payload?.error;
    const fbtrace = metaError?.fbtrace_id
      ? ` (fbtrace=${metaError.fbtrace_id})`
      : "";
    const code = metaError?.code !== undefined ? ` code=${metaError.code}` : "";
    const subcode =
      metaError?.error_subcode !== undefined
        ? ` subcode=${metaError.error_subcode}`
        : "";

    throw new Error(
      `Embedded Signup token exchange failed: ${
        metaError?.message ||
        `${response.status} ${response.statusText}`
      }${code}${subcode}${fbtrace}`,
    );
  }

  const parsed = (await response.json()) as Partial<OAuthExchangeResponse>;

  if (!parsed.access_token) {
    throw new Error(
      "Embedded Signup token exchange returned no access_token in response.",
    );
  }

  return {
    access_token: parsed.access_token,
    token_type: parsed.token_type ?? "bearer",
    expires_in: parsed.expires_in,
  };
}
