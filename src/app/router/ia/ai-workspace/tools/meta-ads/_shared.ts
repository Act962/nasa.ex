import {
  checkMcpAuthorization,
  unauthorizedMessage,
} from "@/lib/meta-mcp/authorization";
import { getMetaAuth } from "@/app/router/meta-ads/_helpers";
import { createMetaMcpClient, type MetaMcpClient } from "@/lib/meta-mcp/client";
import { debitStars } from "@/lib/star-service";
import { StarTransactionType } from "@/generated/prisma/enums";

/**
 * Resultado padrão pra tools Meta MCP que falham por auth/config.
 * Frontend interpreta `unauthorized` e renderiza `<AstroUnauthorizedCard />`.
 */
export type ToolError = {
  ok: false;
  error: "unauthorized" | "no_meta_auth" | "internal";
  message: string;
};

/**
 * Antes de cada tool Meta MCP rodar:
 *  1. Verifica autorização do user
 *  2. Carrega `MetaAuth` da org
 *  3. Cria client (modo MCP ou direto, conforme env)
 *
 * Retorna `{ ok: false, ... }` se falhar — tool retorna direto.
 */
export async function setupMetaTool(
  userId: string,
  orgId: string,
): Promise<
  | { ok: true; client: MetaMcpClient; close: () => Promise<void> }
  | ToolError
> {
  const auth = await checkMcpAuthorization(userId, orgId);
  if (!auth.authorized) {
    return {
      ok: false,
      error: "unauthorized",
      message: unauthorizedMessage(auth.reason),
    };
  }

  const metaAuth = await getMetaAuth(orgId, { userId });
  if (!metaAuth) {
    return {
      ok: false,
      error: "no_meta_auth",
      message:
        "A integração Meta não está conectada nesta organização. Conecte em /integrations primeiro.",
    };
  }

  const client = await createMetaMcpClient(metaAuth);
  return { ok: true, client, close: () => client.close() };
}

/**
 * Debita Stars pra uso de tool Meta MCP. Falha silenciosa (log) — não
 * bloqueia execução se não houver saldo (a tool já rodou).
 */
export async function debitMetaToolStars(
  orgId: string,
  userId: string,
  toolName: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  try {
    await debitStars(
      orgId,
      amount,
      StarTransactionType.APP_CHARGE,
      `Astro Meta Ads — ${toolName}`,
      "meta-ads-mcp",
      userId,
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[meta-mcp:stars] failed to debit", toolName, e);
  }
}
