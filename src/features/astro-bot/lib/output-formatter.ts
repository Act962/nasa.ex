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
export function summarizeStructuredPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { kind?: string; title?: string; data?: unknown };
  if (typeof p.kind !== "string") return null;

  if (p.kind === "astro_chart") {
    const data = Array.isArray(p.data)
      ? (p.data as Array<{ label?: string; value?: number }>)
      : [];
    const top = data.slice(0, 8);
    const items = top
      .map((d, i) => `${i + 1}. ${d.label ?? "?"} — ${d.value ?? 0}`)
      .join("\n");
    const more =
      data.length > top.length ? `\n_(...e mais ${data.length - top.length})_` : "";
    return `*${p.title ?? "Gráfico"}*\n${items}${more}`;
  }

  if (p.kind === "astro_table") {
    const rows = Array.isArray(p.data) ? p.data : [];
    return `*${p.title ?? "Tabela"}* (${rows.length} itens)\n_Veja completo no NASA._`;
  }

  if (p.kind === "astro_videos") {
    const videos = Array.isArray(p.data) ? p.data : [];
    return `*${videos.length} vídeo(s) encontrados*\n_Abre no NASA pra assistir._`;
  }

  return null;
}
