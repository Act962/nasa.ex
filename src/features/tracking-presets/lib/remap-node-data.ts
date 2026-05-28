/**
 * Remapeia referências de slug → id real em `node.data` durante o apply de
 * um TrackingPreset. Substitui:
 *  - `data.tagSlugs: string[]` → `data.tagIds: string[]`
 *  - `data.tagSlug: string`    → `data.tagId: string`
 *  - `data.statusSlug: string` → `data.statusId: string`
 *
 * Outros campos passam intactos. Slug não encontrado é filtrado (não quebra
 * o apply) — Zod já valida isso upstream, então não deveria acontecer.
 *
 * Sem mutação no input — retorna novo objeto.
 */
export function remapNodeData(
  data: Record<string, unknown>,
  maps: {
    tagSlugToId: Map<string, string>;
    statusSlugToId: Map<string, string>;
  },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };

  if (Array.isArray(data.tagSlugs)) {
    const ids = (data.tagSlugs as string[])
      .map((s) => maps.tagSlugToId.get(s))
      .filter((id): id is string => Boolean(id));
    out.tagIds = ids;
    delete out.tagSlugs;
  }

  if (typeof data.tagSlug === "string") {
    const id = maps.tagSlugToId.get(data.tagSlug);
    if (id) out.tagId = id;
    delete out.tagSlug;
  }

  if (typeof data.statusSlug === "string") {
    const id = maps.statusSlugToId.get(data.statusSlug);
    if (id) out.statusId = id;
    delete out.statusSlug;
  }

  return out;
}
