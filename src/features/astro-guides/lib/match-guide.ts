import { ASTRO_GUIDES } from "./registry";
import type { GuideDef } from "./types";

// "crie um lead João" é ordem e segue para a ação; só pedido de aprender vira guia.
// "como está o lead novo?" é consulta: depois do "como" precisa vir um verbo de fazer.
const HOW_TO_VERB =
  "(cri|cadastr|adicion|coloc|inclu|inser|mov|arrast|mud|pass|avanc|troc|personaliz|escond|ocult|mostr|exib|configur|mont|fac|faz|tir|respond|atend|envi|mand|escrev|conect|lig|vincul|integr|ativ|public|compartilh|copi|divulg|peg|ger|elabor|marc|agend|lanc|registr|dispar|convid|busc|procur|encontr|ach|pesquis|localiz|baix|quit|cham|dou|dar|sub|carreg|guard|salv|instal|plane|grav|ped|contrat|anunc|impulsion|fix|escolh|export|deslig|desativ|limit|upload|organiz|vend)\\w*";
const ASKS_HOW_TO = new RegExp(
  `\\bcomo (e que |que )?(eu |a gente |se |posso |consigo |devo |faco (pra|para) |faz (pra|para) )?${HOW_TO_VERB}` +
    "|\\bme (ensina|ensine|mostra|mostre|explica|explique|ajuda|ajude|guia|guie) (a |como |pra |para )" +
    "|\\bpasso a passo|\\btutorial|\\bonde (eu )?(clico|fica|crio|faco)|\\bnao (sei|consigo) (como )?" +
    HOW_TO_VERB +
    "|\\bguia (pra|para|de)\\b",
);

// Palavras que decidem o guia: com uma letra faltando, sobrando ou trocada ("riar", "formulaio")
// o pedido ainda é reconhecido, em vez de cair numa busca que não acha nada.
const TYPO_TOLERANT_WORDS = [
  "como", "criar", "crio", "crie", "fazer", "faco", "montar", "cadastrar", "adicionar", "publicar",
  "conectar", "enviar", "agendar", "configurar", "formulario", "formularios", "proposta", "propostas",
  "tracking", "agenda", "campanha", "campanhas", "produto", "produtos", "contato", "contatos",
  "whatsapp", "relatorio", "tarefa", "tarefas", "pagina", "pasta",
];
const MIN_TYPO_WORD_LENGTH = 4;

function isOneEditAway(word: string, target: string): boolean {
  if (Math.abs(word.length - target.length) > 1) return false;
  let wordIndex = 0;
  let targetIndex = 0;
  let edits = 0;
  while (wordIndex < word.length && targetIndex < target.length) {
    if (word[wordIndex] === target[targetIndex]) {
      wordIndex++;
      targetIndex++;
      continue;
    }
    if (++edits > 1) return false;
    if (word.length > target.length) wordIndex++;
    else if (word.length < target.length) targetIndex++;
    else {
      wordIndex++;
      targetIndex++;
    }
  }
  return edits + (word.length - wordIndex) + (target.length - targetIndex) <= 1;
}

function correctTypo(word: string): string {
  if (word.length < MIN_TYPO_WORD_LENGTH || TYPO_TOLERANT_WORDS.includes(word)) return word;
  return TYPO_TOLERANT_WORDS.find((target) => isOneEditAway(word, target)) ?? word;
}

function normalizeRequest(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(correctTypo)
    .join(" ");
}

export function matchGuideRequest(text: string): GuideDef | null {
  const normalized = normalizeRequest(text);
  if (!ASKS_HOW_TO.test(normalized)) return null;
  return ASTRO_GUIDES.find((guide) => guide.topicPattern.test(normalized)) ?? null;
}
