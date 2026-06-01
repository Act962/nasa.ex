import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { syncNerpClient } from "@/http/sync-nerp/client";

/**
 * Replica um `User` do NASA no NERP (best-effort, retry/backoff).
 * Evento: `sync/user.upsert` — emitido pelo hook `user.create.after`.
 */
export const replicateUserToNerp = inngest.createFunction(
  { id: "sync-replicate-user-to-nerp", retries: 5 },
  { event: "sync/user.upsert" },
  async ({ event, step }) => {
    const userId = (event.data as { userId: string }).userId;

    // Monta o payload DENTRO da step de load: aqui os campos ainda são `Date`
    // reais do Prisma. Se isso fosse feito numa step posterior, o `member`
    // reidratado do JSON memoizado pelo Inngest teria datas como string e
    // `.toISOString()` quebraria.
    const payload = await step.run("load-user", async () => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      };
    });
    if (!payload) return { skipped: "user_not_found", userId };

    await step.run("upsert-to-nerp", () => syncNerpClient.upsertUser(payload));
    return { ok: true, userId };
  },
);
