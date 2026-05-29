import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { syncNerpClient } from "@/http/sync-nerp/client";

/**
 * Replica um `Member` do NASA no NERP (best-effort, retry/backoff).
 * Evento: `sync/member.upsert` — emitido por `organizationHooks.afterAddMember`.
 */
export const replicateMemberToNerp = inngest.createFunction(
  { id: "sync-replicate-member-to-nerp", retries: 5 },
  { event: "sync/member.upsert" },
  async ({ event, step }) => {
    const memberId = (event.data as { memberId: string }).memberId;

    // Monta o payload DENTRO da step de load (campos ainda são `Date` reais).
    const payload = await step.run("load-member", async () => {
      const member = await prisma.member.findUnique({
        where: { id: memberId },
      });
      if (!member) return null;
      return {
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt.toISOString(),
      };
    });
    if (!payload) return { skipped: "member_not_found", memberId };

    await step.run("upsert-to-nerp", () => syncNerpClient.upsertMember(payload));
    return { ok: true, memberId };
  },
);
