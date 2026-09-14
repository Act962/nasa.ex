import type { TrafegoPlatform } from "@/generated/prisma/enums";
import { POLICY_RULES } from "./rules";
import { sourceUrl } from "./sources";
import type { ComplianceLevel, PolicyHit, PrescreenResult } from "./types";

/**
 * Verificação determinística: dicionário e expressões, sem LLM e sem custo.
 *
 * Roda no browser enquanto o cliente digita e de novo no servidor antes de
 * cobrar — o mesmo código nos dois lados, então o aviso que ele viu é o mesmo
 * que decide o checkout. O LLM entra depois, só para o que escapa daqui, e
 * **nunca rebaixa** o que o determinístico marcou.
 */

/** Sem acento, minúsculo e com pontuação virando espaço — casa "coração"/"coracao". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9$%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavra inteira: "vape" casa, "vaporizador" não. */
function containsTerm(haystack: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`).test(haystack);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function excerptAround(original: string, needle: string): string {
  const index = normalize(original).indexOf(normalize(needle));
  if (index < 0) return needle;
  const start = Math.max(0, index - 25);
  const slice = original.slice(start, index + needle.length + 35).trim();
  return `${start > 0 ? "…" : ""}${slice}${index + needle.length + 35 < original.length ? "…" : ""}`;
}

const SEVERITY: Record<ComplianceLevel, number> = { OK: 0, WARNING: 1, BLOCKED: 2 };

export function worstLevel(levels: ComplianceLevel[]): ComplianceLevel {
  return levels.reduce<ComplianceLevel>(
    (worst, level) => (SEVERITY[level] > SEVERITY[worst] ? level : worst),
    "OK",
  );
}

export interface PrescreenInput {
  platform?: TrafegoPlatform | null;
  /** Tudo que o cliente escreveu: ramo, público, copy, destino. */
  texts: Array<string | null | undefined>;
}

export function prescreenAdContent(input: PrescreenInput): PrescreenResult {
  const originals = input.texts.filter((text): text is string => Boolean(text?.trim()));
  if (originals.length === 0) return { level: "OK", hits: [] };

  const joined = originals.join(" \n ");
  const haystack = normalize(joined);
  const hits: PolicyHit[] = [];

  for (const rule of POLICY_RULES) {
    if (rule.platforms && input.platform && !rule.platforms.includes(input.platform)) {
      continue;
    }

    const matchedTerm = rule.terms.find((term) => containsTerm(haystack, term));
    const matchedPattern = rule.patterns?.find((pattern) => pattern.test(joined));
    if (!matchedTerm && !matchedPattern) continue;

    const excerpt = matchedPattern
      ? (joined.match(matchedPattern)?.[0] ?? "").trim()
      : excerptAround(joined, matchedTerm!);

    hits.push({
      ruleId: rule.id,
      label: rule.label,
      reason: rule.reason,
      fix: rule.fix,
      level: rule.level,
      sourceUrl: sourceUrl(rule.sourceId),
      excerpt: excerpt.slice(0, 160),
    });
  }

  return { level: worstLevel(hits.map((hit) => hit.level)), hits };
}

/** Bloco de regras para o system prompt do assistente e da checagem por LLM. */
export function buildPolicyContext(platform?: TrafegoPlatform | null): string {
  const relevant = POLICY_RULES.filter(
    (rule) => !rule.platforms || !platform || rule.platforms.includes(platform),
  );

  const render = (level: "BLOCKED" | "WARNING") =>
    relevant
      .filter((rule) => rule.level === level)
      .map((rule) => `- ${rule.label}: ${rule.reason} Correção: ${rule.fix}`)
      .join("\n");

  return [
    "REGRAS DE PUBLICIDADE (Meta, Google e WhatsApp Oficial), resumidas pela equipe:",
    "",
    "NÃO PODE ANUNCIAR (recusa certa, risco de restrição da conta):",
    render("BLOCKED"),
    "",
    "PODE, MAS COM CUIDADO (reprova com frequência ou exige documentação):",
    render("WARNING"),
  ].join("\n");
}
