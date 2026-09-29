import { ASTRO_GUIDES } from "./registry";
import type { GuideDef } from "./types";

// "crie um lead João" é ordem e segue para a ação; só pedido de aprender vira guia.
// "como está o lead novo?" é consulta: depois do "como" precisa vir um verbo de fazer.
const HOW_TO_VERB =
  "(cri|cadastr|adicion|coloc|inclu|inser|mov|arrast|mud|pass|avanc|troc|personaliz|escond|ocult|mostr|exib|configur|mont|fac|faz|tir)\\w*";
const ASKS_HOW_TO = new RegExp(
  `\\bcomo (e que |que )?(eu |a gente |se |posso |consigo |devo |faco (pra|para) |faz (pra|para) )?${HOW_TO_VERB}` +
    "|\\bme (ensina|ensine|mostra|mostre|explica|explique|ajuda|ajude|guia|guie) (a |como |pra |para )" +
    "|\\bpasso a passo|\\btutorial|\\bonde (eu )?(clico|fica|crio|faco)|\\bnao (sei|consigo) (como )?" +
    HOW_TO_VERB +
    "|\\bguia (pra|para|de)\\b",
);

function normalizeRequest(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function matchGuideRequest(text: string): GuideDef | null {
  const normalized = normalizeRequest(text);
  if (!ASKS_HOW_TO.test(normalized)) return null;
  return ASTRO_GUIDES.find((guide) => guide.topicPattern.test(normalized)) ?? null;
}
