/**
 * Remapeia referências de slug → id real em `node.data` durante o apply de
 * um TrackingPreset. Cada dialog do editor de workflow espera campos
 * específicos — esse helper alinha o spec (slugs portáveis) ao formato
 * exato esperado por cada nodeType.
 *
 * **Padrão de storage do node** (descoberto lendo cada `*/node.tsx`):
 *
 *  - **Aninhado em `data.action.X`**: LEAD_TAGGED, MOVE_LEAD_STATUS, TAG,
 *    FILTER_LEAD, RESPONSIBLE, SEND_MESSAGE, TEMPERATURE, WAIT, WIN_LOSS,
 *    MANUAL_TRIGGER, AI_FINISHED. Esses guardam o values do form sob `action`.
 *  - **Flat em `data.X`**: MOVE_LEAD, HTTP_REQUEST, e TODOS os SEND_* de
 *    "Adicionar Lead no App" (SEND_FORM/AGENDA/PROPOSAL/CONTRACT/LINNKER/NBOX/
 *    NASA_ROUTE) + OPEN_FORM. Esses guardam o values direto em `data`.
 *
 * Erros do passado: presets criavam tudo flat → dialogs aninhados liam
 * vazio do `defaultValues={nodeData.action}` mesmo com tagIds resolvidos.
 * Aí no canvas a borda aparecia verde (helper validava flat tb), mas o
 * user abria o dialog e via tudo em branco. Agora cada node ganha o
 * formato certo.
 */

/** Set de NodeTypes que guardam config em `data.action.X`. */
const NESTED_ACTION_TYPES = new Set([
  "LEAD_TAGGED",
  "MOVE_LEAD_STATUS",
  "TAG",
  "FILTER_LEAD",
  "RESPONSIBLE",
  "SEND_MESSAGE",
  "TEMPERATURE",
  "WAIT",
  "WIN_LOSS",
  "MANUAL_TRIGGER",
  "AI_FINISHED",
  "LAST_INBOUND_TIMEOUT",
]);

function remapFields(
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
      out.tagsIds = ids; // quirk: TAG action usa S extra
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

/**
 * Wrapper público: remapeia campos do data E decide se vai pra flat OU
 * aninhado em `action` baseado no nodeType.
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
  const remapped = remapFields(data, context);

  // Nodes aninhados precisam do data EM `action`. Vazio = ainda exige
  // que action exista pra dialog mostrar form (mesmo que vazio).
  if (NESTED_ACTION_TYPES.has(context.nodeType)) {
    return { action: remapped };
  }
  return remapped;
}
