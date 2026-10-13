import type { Prisma } from "@/generated/prisma/client";

import { extractResponseTagIds } from "@/modules/form/domain/response-tags";

export { extractResponseTagIds };

/**
 * Extrai os `tagId`s embutidos numa resposta de form (campo
 * `field.meta.tagId` — usado pelos blocos radio/checkbox que oferecem
 * "vincular tag à opção" no /form/builder) e aplica como `LeadTag`
 * no lead que finalizou o preenchimento.
 *
 * **Idempotente:** usa `skipDuplicates` — se o lead já tem a tag, não
 * duplica nem joga erro de unique constraint.
 *
 * **Por que existe:** o handler público `submitResponse` já fazia isso
 * pra leads novos/draft, mas os handlers internos (`createResponseForLead`
 * e `updateResponse`, usados em `/formulario/novo/<formId>/<leadId>` e
 * `/formulario/<slug>/<responseId>`) não aplicavam. Resultado: tags
 * escolhidas durante preenchimento interno não apareciam no card do lead.
 *
 * @param tx Cliente Prisma (pode ser o cliente global ou o `tx` de
 *           uma transação — funciona em ambos porque só usa findMany +
 *           createMany).
 * @param leadId Lead que recebe as tags.
 * @param responseJson String JSON do `jsonResponse` do form.
 * @returns Quantidade de tags aplicadas (excluindo duplicatas skipadas).
 */
export async function applyResponseTagsToLead(
  tx: Pick<Prisma.TransactionClient, "tag" | "leadTag">,
  leadId: string,
  responseJson: string,
): Promise<number> {
  if (!leadId || !responseJson) return 0;

  const tagIds = extractResponseTagIds(responseJson);
  if (tagIds.length === 0) return 0;

  // Confirma que as tags existem (defensivo — `radio-select-block`
  // pode ter ficado com `tagId` órfão se a tag foi deletada depois).
  const existingTags = await tx.tag.findMany({
    where: { id: { in: Array.from(new Set(tagIds)) } },
    select: { id: true },
  });
  if (existingTags.length === 0) return 0;

  const result = await tx.leadTag.createMany({
    data: existingTags.map((t) => ({ leadId, tagId: t.id })),
    skipDuplicates: true,
  });

  return result.count;
}
