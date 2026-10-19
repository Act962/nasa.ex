// Reclamação de demora (spec 0113, RF-8): regra de texto, sem chamada de IA. Só é avaliada em mensagem
// que chega enquanto o cliente espera resposta, para não confundir "demora" num assunto qualquer.

const COMPLAINT_PATTERNS: RegExp[] = [
  /\bdemor(a|ando|ou|aram|ando demais|ou demais)\b/,
  /\bninguem (me )?(responde|atende|respondeu|atendeu)\b/,
  /\b(vou|vamos) (procurar|buscar|comprar|fechar) (em )?outr[ao]\b/,
  /\boutra (empresa|loja|oficina)\b/,
  /\bdesist(o|i|ir)\b/,
  /\b(cade|kd) (voces|vcs|o atendimento|alguem)\b/,
  /\b(absurdo|descaso|pessimo atendimento|falta de respeito)\b/,
  /\bto esperando\b|\bestou esperando\b|\bja (faz|tem) \w+ (min|minutos|hora|horas)\b/,
];

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeDelayComplaint(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalizedText = normalizeText(text);
  return COMPLAINT_PATTERNS.some((pattern) => pattern.test(normalizedText));
}
