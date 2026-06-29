import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { syncNerpClient } from "@/http/sync-nerp/client";
import { ecosystemSyncComments } from "@/http/ecosystem-sync/comments";

/**
 * Replica um `Member` do NASA no NERP e no comments-app (best-effort, retry/backoff).
 * Evento: `sync/member.upsert`.
 *
 * AUTO-SUFICIENTE: além do Member, garante que User + Account(s) + Organization
 * existam no NERP, fazendo upsert NA ORDEM DE FK (user → accounts → org →
 * member). Assim qualquer rota que crie membro (incl. as raw-prisma fora do
 * better-auth) só precisa emitir o `memberId` — o resto viaja junto, e não
 * dependemos do retry 409 do inbound pra convergir. Replicar o(s) Account
 * também garante paridade de login no NERP (senha scrypt é compatível).
 */
export const replicateMemberToNerp = inngest.createFunction(
  {
    id: "sync-replicate-member-to-nerp",
    retries: 5,
    onFailure: ({ event, error }) => {
      // Dead-letter: esgotou os retries. Loga pra observabilidade.
      const memberId = (event.data?.event?.data as { memberId?: string })
        ?.memberId;
      console.error(
        "[sync] replicate-member-to-nerp esgotou retries:",
        { memberId },
        error,
      );
    },
  },
  { event: "sync/member.upsert" },
  async ({ event, step }) => {
    const memberId = (event.data as { memberId: string }).memberId;

    // Carrega o grafo inteiro numa step só, montando os payloads enquanto as
    // datas ainda são `Date` reais do Prisma (numa step posterior elas viriam
    // reidratadas como string do JSON memoizado e `.toISOString()` quebraria).
    const graph = await step.run("load-member-graph", async () => {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
      });
      if (!member) return null;

      const [user, org, accounts] = await Promise.all([
        prisma.user.findUnique({ where: { id: member.userId } }),
        prisma.organization.findUnique({
          where: { id: member.organizationId },
        }),
        prisma.account.findMany({ where: { userId: member.userId } }),
      ]);

      return {
        member: {
          id: member.id,
          organizationId: member.organizationId,
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt.toISOString(),
        },
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              emailVerified: user.emailVerified,
              image: user.image,
              phone: user.phone,
              createdAt: user.createdAt.toISOString(),
              updatedAt: user.updatedAt.toISOString(),
            }
          : null,
        org: org
          ? {
              id: org.id,
              name: org.name,
              slug: org.slug,
              logo: org.logo,
              metadata: org.metadata,
              createdAt: org.createdAt.toISOString(),
            }
          : null,
        accounts: accounts.map((account) => ({
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
        })),
      };
    });

    if (!graph) return { skipped: "member_not_found", memberId };

    // Cada destino é uma cadeia FK independente (user → accounts → org →
    // member, idempotente por id no inbound). A ordem de FK é preservada DENTRO
    // de cada destino; os dois destinos rodam em PARALELO via `Promise.all`, de
    // modo que o NERP fora do ar não bloqueia o comments-app e vice-versa.
    const replicateToNerp = (async () => {
      if (graph.user) {
        await step.run("upsert-user", () =>
          syncNerpClient.upsertUser(graph.user!),
        );
      }
      for (let i = 0; i < graph.accounts.length; i++) {
        const account = graph.accounts[i];
        await step.run(`upsert-account-${i}`, () =>
          syncNerpClient.upsertAccount(account),
        );
      }
      if (graph.org) {
        await step.run("upsert-org", () => syncNerpClient.upsertOrg(graph.org!));
      }
      await step.run("upsert-member", () =>
        syncNerpClient.upsertMember(graph.member),
      );
    })();

    const replicateToComments = (async () => {
      if (graph.user) {
        await step.run("comments-upsert-user", () =>
          ecosystemSyncComments.upsertUser(graph.user!),
        );
      }
      for (
        let accountIndex = 0;
        accountIndex < graph.accounts.length;
        accountIndex++
      ) {
        const account = graph.accounts[accountIndex];
        await step.run(`comments-upsert-account-${accountIndex}`, () =>
          ecosystemSyncComments.upsertAccount(account),
        );
      }
      if (graph.org) {
        await step.run("comments-upsert-org", () =>
          ecosystemSyncComments.upsertOrg(graph.org!),
        );
      }
      await step.run("comments-upsert-member", () =>
        ecosystemSyncComments.upsertMember(graph.member),
      );
    })();

    await Promise.all([replicateToNerp, replicateToComments]);

    return { ok: true, memberId };
  },
);
