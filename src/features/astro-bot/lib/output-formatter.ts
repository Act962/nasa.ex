/**
 * Converte saída rica do Astro (markdown + payloads estruturados) em texto
 * compatível com WhatsApp.
 *
 * Regras de conversão:
 *   - markdown headers (# / ## / ###) → *bold* (WhatsApp usa *texto* pra bold)
 *   - **bold** → *bold*
 *   - *italic* → _italic_
 *   - tabelas markdown → listas numeradas
 *   - links [texto](url) → texto: url
 *   - charts/tables payloads → resumo textual (até 8 itens) + sugestão "Abre no NASA: <url>"
 *
 * Pra MVP, focamos em texto puro — payloads estruturados viram resumo.
 * Fase 3 vai gerar imagem do chart e enviar via sendMedia.
 */
import "server-only";

export function markdownToWhatsapp(md: string): string {
  let out = md;

  // Headers → *bold* (WhatsApp não tem header)
  out = out.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");

  // Bold **x** → *x*
  out = out.replace(/\*\*([^*]+)\*\*/g, "*$1*");

  // Italic *x* (não-bold) → _x_
  // Só matcha *x* que não foi convertido pra bold acima
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "_$1_");

  // Links [texto](url) → texto: url
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2");

  // Tabelas markdown — detecta `| col1 | col2 |` pattern e converte
  // em lista numerada. Pra MVP simplifica: pega a 1ª coluna como rótulo
  // e o resto como info "k: v".
  out = convertMarkdownTables(out);

  // Code blocks: tira backticks tripos (` ```js` → bloco indentado)
  out = out.replace(/```[a-z]*\n([\s\S]*?)```/g, (_, code) => {
    return code
      .split("\n")
      .map((l: string) => `    ${l}`)
      .join("\n");
  });
  // Inline code `x` → "x"
  out = out.replace(/`([^`\n]+)`/g, '"$1"');

  // Lista markdown `- item` ou `* item` → "• item" (WhatsApp friendly)
  out = out.replace(/^\s*[-*]\s+(.+)$/gm, "• $1");

  // Lista numerada `1. item` → mantém (WhatsApp respeita)
  // (no-op)

  // Remove linhas em branco extras (mais de 2 seguidas vira 2)
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

/**
 * Frases de copiloto que não cabem num chat de WhatsApp (lead-ins e ofertas de
 * ajuda no fim). O prompt já pede pra evitar, mas o modelo escapa — esta é a
 * rede de segurança determinística.
 */
const FILLER_LINE_PATTERNS: RegExp[] = [
  /^(aqui (est[áa]|est[ãa]o)|claro|com certeza|perfeito|segue[m]?|veja[m]?)\b/i,
  /(se (precisar|quiser|tiver d[úu]vida)|qualquer d[úu]vida|espero ter ajudado|estou [àa] disposi[çc][ãa]o|fico [àa] disposi[çc][ãa]o|[ée] s[óo] (falar|avisar|dizer|pedir|chamar)|quer que eu|posso ajudar)/i,
];

const LIST_LINE_PATTERN = /^\s*(?:[•\-*]\s|\d+[.)]\s)/;
const LABEL_LINE_PATTERN = /^_?[^:_]{0,40}:_?$/;

/**
 * Limpa a prosa do modelo antes de anexar o resumo estruturado:
 *   - sempre remove linhas de firula (lead-in / oferta de ajuda);
 *   - quando há tabela/lista estruturada logo abaixo (`hasStructured`), remove
 *     também os itens de lista e os rótulos órfãos que o modelo repetiu — assim
 *     a lista não aparece duas vezes.
 * Retorna "" quando nada substantivo sobra (o caller cai só no resumo).
 */
export function cleanWhatsappReply(
  text: string,
  options: { hasStructured: boolean },
): string {
  const keptLines = text.split("\n").filter((rawLine) => {
    const line = rawLine.trim();
    if (line.length === 0) return true;
    if (FILLER_LINE_PATTERNS.some((pattern) => pattern.test(line))) return false;
    if (options.hasStructured) {
      if (LIST_LINE_PATTERN.test(line)) return false;
      if (LABEL_LINE_PATTERN.test(line)) return false;
    }
    return true;
  });

  const cleaned = keptLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Se sobrou só pontuação/sobra trivial, descarta — o resumo estruturado basta.
  return cleaned.replace(/[\s•·–—-]/g, "").length === 0 ? "" : cleaned;
}

function convertMarkdownTables(text: string): string {
  // Detecta blocos: linha header | linha separador --- | linhas dados |
  return text.replace(
    /(\|[^\n]+\|\n\|[\s\-:]+\|\n(?:\|[^\n]+\|\n?)+)/g,
    (block) => {
      const lines = block.trim().split("\n");
      if (lines.length < 3) return block;
      const headers = lines[0]!
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const dataRows = lines.slice(2).map((line) =>
        line
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean),
      );

      const formatted = dataRows
        .map((row, idx) => {
          const first = row[0] ?? "";
          const rest = row
            .slice(1)
            .map((val, i) => `${headers[i + 1] ?? "?"}: ${val}`)
            .join(" · ");
          return `${idx + 1}. *${first}* — ${rest}`;
        })
        .join("\n");

      return `\n${formatted}\n`;
    },
  );
}

/**
 * Resume payload estruturado em texto. Pra MVP, charts/tables viram
 * resumo. Fase 3 vai gerar imagem via puppeteer + sendMedia.
 */
const TABLE_SUMMARY_MAX_ROWS = 8;

type TableColumn = { key?: string; label?: string };
type TableRow = Record<string, string | number | boolean | null | undefined>;

export function summarizeStructuredPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    kind?: string;
    title?: string;
    data?: unknown;
    rows?: unknown;
    columns?: unknown;
    totalCount?: number;
  };
  if (typeof p.kind !== "string") return null;

  if (p.kind === "astro_chart") {
    const data = Array.isArray(p.data)
      ? (p.data as Array<{ label?: string; value?: number }>)
      : [];
    const top = data.slice(0, TABLE_SUMMARY_MAX_ROWS);
    const items = top
      .map((point, index) => `${index + 1}. ${point.label ?? "?"} — ${point.value ?? 0}`)
      .join("\n");
    const more =
      data.length > top.length ? `\n_(...e mais ${data.length - top.length})_` : "";
    return `*${p.title ?? "Gráfico"}*\n${items}${more}`;
  }

  if (p.kind === "astro_table") {
    // O payload real usa `rows` + `columns` (não `data`). Renderiza as linhas
    // como lista legível — no WhatsApp não dá pra "clicar" na tabela, então o
    // conteúdo precisa vir no texto.
    const rows = (Array.isArray(p.rows) ? p.rows : []) as TableRow[];
    const columns = (Array.isArray(p.columns) ? p.columns : []) as TableColumn[];
    const total = typeof p.totalCount === "number" ? p.totalCount : rows.length;
    if (rows.length === 0) {
      return `*${p.title ?? "Tabela"}*\nNenhum item encontrado.`;
    }
    const primaryKey = columns[0]?.key ?? "name";
    const top = rows.slice(0, TABLE_SUMMARY_MAX_ROWS);
    const lines = top.map((row, index) => {
      const primary = String(row[primaryKey] ?? "—");
      const contact = [row.phone, row.email]
        .filter((value) => value != null && value !== "")
        .map(String)
        .join(" · ");
      const status = row.status != null && row.status !== "" ? ` · ${row.status}` : "";
      return `${index + 1}. *${primary}*${contact ? ` — ${contact}` : ""}${status}`;
    });
    const more =
      total > top.length ? `\n_(...e mais ${total - top.length})_` : "";
    return `*${p.title ?? "Tabela"}* (${total})\n${lines.join("\n")}${more}`;
  }

  if (p.kind === "astro_videos") {
    const videos = Array.isArray(p.data) ? p.data : [];
    return `*${videos.length} vídeo(s) encontrados*\n_Abre no NASA pra assistir._`;
  }

  return null;
}
