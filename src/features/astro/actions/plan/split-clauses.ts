// Detector de pedido composto (spec 0033, RF-6): corta a frase onde um
// conector ("e", vírgula, "depois", "também") vem seguido de um verbo de ação.
// "Reunião com Maria e João" não corta — "João" não é verbo.

const CLAUSE_VERBS = [
  "cria", "crie", "criar", "cadastra", "cadastre", "marca", "marque", "agende",
  "move", "mova", "mover", "passa", "passe", "coloca", "coloque", "poe", "ponha", "bota",
  "adiciona", "adicione", "aplica", "aplique", "manda", "mande", "envia", "envie",
  "avisa", "avise", "anota", "anote", "lanca", "lance", "registra", "registre",
  "exclui", "exclua", "apaga", "apague", "remarca", "remarque", "cancela", "cancele",
  "atribui", "atribua", "lembra", "lembre", "publica", "publique", "favorita",
  "renomeia", "arquiva", "encaminha", "dispara", "abre", "inicia", "muda", "altera",
].join("|");

const CLAUSE_BOUNDARY = new RegExp(
  `(?:\\s*,\\s*(?:e\\s+)?|\\s+e\\s+(?:depois\\s+|tambem\\s+)?|\\s+depois\\s+|\\s+tambem\\s+)` +
    `(?=(?:me\\s+|ja\\s+)?(?:${CLAUSE_VERBS})\\b)`,
  "g",
);

/** Minúsculas e sem acento, caractere a caractere — as posições batem com o original. */
function normalizeKeepingPositions(text: string): string {
  return [...text]
    .map((char) => {
      const plain = char.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      return plain.length === char.length ? plain : char;
    })
    .join("");
}

export function splitIntoClauses(text: string): string[] {
  const normalized = normalizeKeepingPositions(text);
  const clauses: string[] = [];
  let start = 0;
  for (const match of normalized.matchAll(CLAUSE_BOUNDARY)) {
    const index = match.index ?? 0;
    if (index > start) clauses.push(text.slice(start, index));
    start = index + match[0].length;
  }
  clauses.push(text.slice(start));
  return clauses.map((clause) => clause.trim().replace(/[.!?]+$/, "")).filter((clause) => clause.length > 0);
}

export function normalizeClause(text: string): string {
  return normalizeKeepingPositions(text);
}
