import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { syncNerpClient } from "@/http/sync-nerp/client";
import { ecosystemSyncComments } from "@/http/ecosystem-sync/comments";

/**
 * Replica um `Account` do NASA no NERP e no comments-app (best-effort, retry/backoff).
 * Como nenhum lado sobrescreve o hash de senha (scrypt default), o
 * `Account.password` replicado loga no destino sem reset.
 * Evento: `sync/account.upsert` — emitido pelo hook `account.create.after`.
 *
 * Fan-out: os dois alvos rodam em paralelo via `Promise.all`, cada um em sua
 * própria `step.run` → independentes entre si. Um destino fora do ar não
 * bloqueia o outro.
 */
export const replicateAccountToNerp = inngest.createFunction(
  { id: "sync-replicate-account-to-nerp", retries: 5 },
  { event: "sync/account.upsert" },
  async ({ event, step }) => {
    const accountId = (event.data as { accountId: string }).accountId;

    // Monta o payload DENTRO da step de load (campos ainda são `Date` reais).
    // Numa step posterior, as datas reidratadas do JSON memoizado seriam string
    // e `.toISOString()` quebraria.
    const payload = await step.run("load-account", async () => {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });
      if (!account) return null;
      return {
        id: account.id,
        accountId: account.accountId,
        providerId: account.providerId,
        userId: account.userId,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        idToken: account.idToken,
        accessTokenExpiresAt:
          account.accessTokenExpiresAt?.toISOString() ?? null,
        refreshTokenExpiresAt:
          account.refreshTokenExpiresAt?.toISOString() ?? null,
        scope: account.scope,
        password: account.password,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      };
    });
    if (!payload) return { skipped: "account_not_found", accountId };

    await Promise.all([
      step.run("upsert-to-nerp", () => syncNerpClient.upsertAccount(payload)),
      step.run("upsert-to-comments", () =>
        ecosystemSyncComments.upsertAccount(payload),
      ),
    ]);
    return { ok: true, accountId };
  },
);
