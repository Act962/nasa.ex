/**
 * Lê os `tagId`s de uma resposta de form. Escolha única grava
 * `meta.tagId`; múltipla escolha grava `meta.tagIds` — os dois valem.
 */
export function extractResponseTagIds(responseJson: string): string[] {
  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(responseJson);
  } catch {
    return [];
  }
  if (!parsedResponse || typeof parsedResponse !== "object") return [];

  const tagIds = new Set<string>();
  for (const field of Object.values(parsedResponse as Record<string, unknown>)) {
    if (!field || typeof field !== "object") continue;
    const meta = (field as { meta?: unknown }).meta;
    if (!meta || typeof meta !== "object") continue;
    const { tagId, tagIds: multipleTagIds } = meta as {
      tagId?: unknown;
      tagIds?: unknown;
    };
    if (typeof tagId === "string" && tagId) tagIds.add(tagId);
    if (Array.isArray(multipleTagIds)) {
      for (const multipleTagId of multipleTagIds) {
        if (typeof multipleTagId === "string" && multipleTagId) {
          tagIds.add(multipleTagId);
        }
      }
    }
  }
  return Array.from(tagIds);
}
