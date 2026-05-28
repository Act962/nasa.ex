/**
 * Remapeia referências de slug → id real em `node.data` durante o apply de
 * um TrackingPreset. Cada dialog do editor de workflow espera campos
 * específicos — esse helper alinha o spec (slugs portáveis) ao formato
 * exato esperado por cada nodeType:
 *
 *  - LEAD_TAGGED (trigger): `data.tagIds: string[]`
 *  - TAG (action):         `data.tagsIds: string[]` (com S extra!) + `type: "ADD"`
 *  - MOVE_LEAD (action):   `data.statusId` + `data.trackingId` (do tracking destino)
 *  - MOVE_LEAD_STATUS:     `data.statusId`
 *  - FILTER_LEAD:          `data.conditions[].tagIds` (já remapeado abaixo)
 *
 * Outros campos passam intactos. Slug não encontrado é filtrado (não quebra
 * o apply) — Zod já valida isso upstream, então não deveria acontecer.
 *
 * Sem mutação no input — retorna novo objeto.
 */
export function remapNodeData(
  data: Record<string, unknown>,
  context: {
    nodeType: string;
    trackingId: string;
    maps: {
      tagSlugToId: Map<string, string>;
      statusSlugToId: Map<string, string>;
    };
  },
): Record<string, unknown> {
  const { nodeType, trackingId, maps } = context;
  const out: Record<string, unknown> = { ...data };

  // ── tagSlugs → tagIds OR tagsIds (depende do nodeType) ────────────────
  if (Array.isArray(data.tagSlugs)) {
    const ids = (data.tagSlugs as string[])
      .map((s) => maps.tagSlugToId.get(s))
      .filter((id): id is string => Boolean(id));
    if (nodeType === "TAG") {
      // TAG action usa `tagsIds` (com S). Quirk histórico da feature.
      out.tagsIds = ids;
      // Injeta `type: "ADD"` se faltar — TAG action exige type ADD|REMOVE.
      if (!out.type) out.type = "ADD";
    } else {
      out.tagIds = ids;
    }
    delete out.tagSlugs;
  }

  if (typeof data.tagSlug === "string") {
    const id = maps.tagSlugToId.get(data.tagSlug);
    if (id) out.tagId = id;
    delete out.tagSlug;
  }

  // ── statusSlug → statusId ─────────────────────────────────────────────
  if (typeof data.statusSlug === "string") {
    const id = maps.statusSlugToId.get(data.statusSlug);
    if (id) out.statusId = id;
    delete out.statusSlug;
  }

  // ── MOVE_LEAD action requer trackingId do destino ─────────────────────
  if (nodeType === "MOVE_LEAD") {
    out.trackingId = trackingId;
  }

  // ── FILTER_LEAD: conditions[].tagSlugs → conditions[].tagIds ─────────
  if (Array.isArray(data.conditions)) {
    out.conditions = (data.conditions as any[]).map((cond) => {
      if (Array.isArray(cond?.tagSlugs)) {
        const ids = cond.tagSlugs
          .map((s: string) => maps.tagSlugToId.get(s))
          .filter((id: string | undefined): id is string => Boolean(id));
        const { tagSlugs: _drop, ...rest } = cond;
        return { ...rest, tagIds: ids };
      }
      return cond;
    });
  }

  return out;
}
