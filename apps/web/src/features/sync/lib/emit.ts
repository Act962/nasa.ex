import { inngest } from "@/inngest/client";

/**
 * Enfileira a replicação de um Member pro NERP (best-effort).
 *
 * Usado pelas rotas raw-prisma de adicionar participante (que NÃO passam pelo
 * `organizationHooks.afterAddMember` do better-auth). A função Inngest
 * `replicate-member-to-nerp` é auto-suficiente: garante User + Account + Org no
 * NERP antes do Member, então basta mandar o `memberId`.
 *
 * NUNCA lança: uma falha de enfileiramento não pode quebrar a adição do membro.
 */
export async function enqueueMemberSync(memberId: string): Promise<void> {
  try {
    await inngest.send({ name: "sync/member.upsert", data: { memberId } });
  } catch (e) {
    console.error("[sync emit] member.upsert enqueue failed:", e, { memberId });
  }
}
