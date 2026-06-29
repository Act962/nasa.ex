/**
 * builder-path-utils — leitura/escrita por dot-notation em objetos.
 *
 * Usados pelo reorder DENTRO de sections compostas (depoimentos,
 * features, planos, blocos intermediários). O `SortableSectionItem`
 * marca `data.collection` que pode ser aninhado (ex:
 * "interlude.afterCards"); estes helpers seguem os segmentos do path
 * pra ler o array atual (`getByPath`) e produzir um PATCH com só o
 * ramo modificado (`setByPath`) pro `updateElement` do store.
 */

/**
 * Lê um valor por path dot-notation num objeto. Ex: getByPath(el, "interlude.afterCards").
 * Retorna `undefined` se algum segmento não existe.
 */
export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Devolve um PATCH (objeto raiz com apenas o primeiro segmento atualizado)
 * pra updateElement, preservando os outros valores. Necessário porque o
 * store faz spread superficial — se mexêssemos só num campo aninhado fora
 * dele, perderíamos os irmãos.
 *
 * Ex: setByPath(el, "interlude.afterCards", [...]) → { interlude: { ...elInterlude, afterCards: [...] } }
 */
export function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) {
    return { [head]: value };
  }
  const current = (obj[head] as Record<string, unknown> | undefined) ?? {};
  return {
    [head]: { ...current, ...setByPath(current, rest.join("."), value) },
  };
}
