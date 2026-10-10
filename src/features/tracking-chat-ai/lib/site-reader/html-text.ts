// Tira o texto legível de uma página. O HTML é de terceiros: nada dele é executado
// nem guardado, só o texto e os links do próprio site (spec 0088, S-7).

const DROPPED_BLOCKS = /<(script|style|noscript|svg|iframe|template|form|select|head)\b[\s\S]*?<\/\1\s*>/gi;
const BLOCK_BREAKS = /<\/?(p|div|section|article|header|footer|main|aside|nav|li|ul|ol|tr|table|h[1-6]|br|hr|address|blockquote|dd|dt)\b[^>]*>/gi;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ccedil: "ç", Ccedil: "Ç",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", atilde: "ã", otilde: "õ",
  acirc: "â", ecirc: "ê", ocirc: "ô", agrave: "à", Aacute: "Á", Eacute: "É", Iacute: "Í",
  Oacute: "Ó", Uacute: "Ú", Atilde: "Ã", Otilde: "Õ", Acirc: "Â", Ecirc: "Ê", Ocirc: "Ô",
  ordm: "º", ordf: "ª", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(parseInt(code, 16) || 32))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name] ?? match);
}

export function extractPageTitle(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return decodeEntities(title.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Linha que tenta dar ordem a uma IA. Site de empresa não fala assim com o cliente; sai antes de qualquer modelo ler. */
const INSTRUCTION_LIKE_LINE =
  /\b(ignor[ea]\w*|desconsider[ea]\w*|esque[cç]a\w*|disregard|forget)\b.{0,60}\b(instru[cç][aãoõ]\w*|regras?|prompt|instructions?|rules|anterior\w*|previous|acima|above)\b|\b(voc[eê]|you)\s+(agora\s+)?(deve|[eé]|are\s+now|must|should)\b.{0,40}\b(assistente|ia|ai|modelo|model|chatbot|bot)\b|\b(system|developer)\s*(prompt|message)\b|\bprompt\s+do\s+sistema\b|\bjailbreak\b|\b(assistente|agente|modelo|rob[oô])\s+(de\s+)?(ia|ai|intelig[eê]ncia\s+artificial|linguagem|virtual)\b.{0,60}\b(registre|informe|diga|responda|deve|fa[cç]a|ligue|ative|envie|considere|anote|use)\b|\b(llm|chatgpt|gpt)\b.{0,60}\b(registre|informe|diga|responda|deve|fa[cç]a|considere|anote)\b/i;

export function isInstructionLikeLine(line: string): boolean {
  return INSTRUCTION_LIKE_LINE.test(line);
}

export function extractPageText(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, " ");
  const text = withoutComments
    .replace(DROPPED_BLOCKS, " ")
    .replace(BLOCK_BREAKS, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isInstructionLikeLine(line))
    // Menu e rodapé se repetem em toda página: linha igual à anterior não soma nada.
    .filter((line, index, lines) => line !== lines[index - 1])
    .join("\n");
}

export interface PageLink {
  url: string;
  label: string;
}

export function extractPageLinks(html: string, pageUrl: string): PageLink[] {
  const links: PageLink[] = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    try {
      const url = new URL(decodeEntities(match[1]), pageUrl);
      if (url.protocol !== "https:") continue;
      url.hash = "";
      const label = decodeEntities(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      links.push({ url: url.toString(), label: label.slice(0, 80) });
    } catch {
      // href malformado não é link.
    }
  }
  return links;
}
