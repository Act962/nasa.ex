import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import prismaDefault from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

interface Args {
  tx?: PrismaLike;
  trackingId: string;
  tagIds: string[];
}

/**
 * Workflows do tracking com gatilho LEAD_TAGGED que casam com QUALQUER uma das
 * tags recém-aplicadas (semântica de overlap, não de subset).
 *
 * Por que existe: a query antiga `array_contains: tagIds` usa `@>` no JSONB
 * (workflow.action.tagIds ⊇ tagIds[]). Quando se aplica 2+ tags de uma vez,
 * um workflow configurado pra UMA dessas tags nunca casa. O fix é rodar uma
 * query por tag e deduplicar — match acontece se o trigger lista pelo menos
 * uma das tags adicionadas.
 *
 * Compartilhado entre o router humano (`router/leads/add-tags.ts`) e a IA
 * (`tracking-chat-ai/lib/apply-tags-by-ai.ts`) — antes era cópia consciente.
 */
export async function findLeadTaggedMatchingWorkflows({
  tx,
  trackingId,
  tagIds,
}: Args): Promise<{ id: string }[]> {
  if (tagIds.length === 0) return [];

  const client = tx ?? prismaDefault;

  const perTag = await Promise.all(
    tagIds.map((tagId) =>
      client.workflow.findMany({
        where: {
          trackingId,
          isActive: true,
          nodes: {
            some: {
              type: "LEAD_TAGGED",
              data: {
                path: ["action", "tagIds"],
                array_contains: [tagId],
              },
            },
          },
        },
        select: { id: true },
      }),
    ),
  );

  const seen = new Set<string>();
  const out: { id: string }[] = [];
  for (const list of perTag) {
    for (const wf of list) {
      if (seen.has(wf.id)) continue;
      seen.add(wf.id);
      out.push(wf);
    }
  }
  return out;
}
