// A descrição do card é o JSON do TipTap (o editor da tela grava `JSON.stringify(editor.getJSON())`). A IA escreve
// Markdown: estas funções convertem nos dois sentidos, só com os nós do StarterKit (spec 0143, RF-9).

export interface TiptapMark {
  type: "bold" | "italic" | "strike" | "code" | "link";
  attrs?: { href: string };
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET_ITEM = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED_ITEM = /^(\s*)(\d+)[.)]\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s*```/;
const QUOTE = /^\s*>\s?(.*)$/;

// Ordem importa: negrito antes de itálico, link antes de URL solta.
const INLINE =
  /(\*\*|__)(.+?)\1|~~(.+?)~~|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(?<![\w*])\*(?![\s*])(.+?)(?<![\s*])\*(?![\w*])|(?<![\w_])_(?![\s_])(.+?)(?<![\s_])_(?![\w_])|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'")\]])/;

function textNode(text: string, marks: TiptapMark[]): TiptapNode {
  return marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

function parseInline(source: string, marks: TiptapMark[] = []): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  let rest = source;
  while (rest.length > 0) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(textNode(rest, marks));
      break;
    }
    if (match.index > 0) nodes.push(textNode(rest.slice(0, match.index), marks));
    const [whole, , boldText, strikeText, codeText, linkText, linkHref, starItalic, underscoreItalic, bareUrl] = match;
    if (boldText !== undefined) nodes.push(...parseInline(boldText, [...marks, { type: "bold" }]));
    else if (strikeText !== undefined) nodes.push(...parseInline(strikeText, [...marks, { type: "strike" }]));
    else if (codeText !== undefined) nodes.push(textNode(codeText, [...marks, { type: "code" }]));
    else if (linkText !== undefined && linkHref) nodes.push(...parseInline(linkText, [...marks, { type: "link", attrs: { href: linkHref } }]));
    else if (starItalic !== undefined || underscoreItalic !== undefined) nodes.push(...parseInline(starItalic ?? underscoreItalic ?? "", [...marks, { type: "italic" }]));
    else if (bareUrl !== undefined) nodes.push(textNode(bareUrl, [...marks, { type: "link", attrs: { href: bareUrl } }]));
    rest = rest.slice(match.index + whole.length);
  }
  return nodes.filter((node) => node.text !== "");
}

/** Linhas seguidas viram um parágrafo com quebra de linha, como a IA escreveu. */
function paragraphOf(lines: string[]): TiptapNode {
  const content: TiptapNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) content.push({ type: "hardBreak" });
    content.push(...parseInline(line.trim()));
  });
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

interface ListLine {
  indent: number;
  isOrdered: boolean;
  start: number;
  text: string;
}

function readListLine(line: string): ListLine | null {
  const bullet = BULLET_ITEM.exec(line);
  if (bullet && !RULE.test(line)) return { indent: bullet[1].length, isOrdered: false, start: 1, text: bullet[2] };
  const ordered = ORDERED_ITEM.exec(line);
  if (ordered) return { indent: ordered[1].length, isOrdered: true, start: Number(ordered[2]), text: ordered[3] };
  return null;
}

/** Lista com sublistas por recuo (2 espaços ou mais a mais que o item de cima). */
function buildList(items: ListLine[]): TiptapNode {
  const first = items[0];
  const list: TiptapNode = first.isOrdered
    ? { type: "orderedList", attrs: { start: first.start }, content: [] }
    : { type: "bulletList", content: [] };
  let index = 0;
  while (index < items.length) {
    const item = items[index];
    const children: ListLine[] = [];
    index++;
    while (index < items.length && items[index].indent >= item.indent + 2) {
      children.push(items[index]);
      index++;
    }
    const listItem: TiptapNode = { type: "listItem", content: [paragraphOf([item.text])] };
    if (children.length > 0) listItem.content?.push(buildList(children));
    list.content?.push(listItem);
  }
  return list;
}

export function markdownToTiptap(markdown: string): TiptapNode {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: TiptapNode[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push(paragraphOf(paragraph));
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    if (FENCE.test(line)) {
      // Sem bloco de código no editor (codeBlock desligado): cada linha vira um parágrafo em código.
      flushParagraph();
      index++;
      while (index < lines.length && !FENCE.test(lines[index])) {
        blocks.push(lines[index] ? { type: "paragraph", content: [textNode(lines[index], [{ type: "code" }])] } : { type: "paragraph" });
        index++;
      }
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      const content = parseInline(heading[2].trim());
      blocks.push({ type: "heading", attrs: { level: Math.min(heading[1].length, 3) }, ...(content.length > 0 ? { content } : {}) });
      continue;
    }
    if (RULE.test(line)) {
      flushParagraph();
      blocks.push({ type: "horizontalRule" });
      continue;
    }
    if (QUOTE.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      while (index < lines.length && QUOTE.test(lines[index])) {
        quoted.push(QUOTE.exec(lines[index])?.[1] ?? "");
        index++;
      }
      index--;
      blocks.push({ type: "blockquote", content: markdownToTiptap(quoted.join("\n")).content ?? [] });
      continue;
    }
    if (readListLine(line)) {
      flushParagraph();
      const items: ListLine[] = [];
      const kind = readListLine(line)?.isOrdered;
      while (index < lines.length) {
        const item = readListLine(lines[index]);
        if (!item || (item.indent === 0 && item.isOrdered !== kind)) break;
        items.push(item);
        index++;
      }
      index--;
      blocks.push(buildList(items));
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return { type: "doc", content: blocks.length > 0 ? blocks : [{ type: "paragraph" }] };
}

/** O que vai no campo `description`: o mesmo formato que o editor grava. */
export function markdownToDescription(markdown: string): string {
  return JSON.stringify(markdownToTiptap(markdown));
}

function inlineToMarkdown(nodes: TiptapNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      let text = node.text ?? inlineToMarkdown(node.content);
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "strike") text = `~~${text}~~`;
        else if (mark.type === "code") text = `\`${text}\``;
        else if (mark.type === "link" && mark.attrs?.href && mark.attrs.href !== text) text = `[${text}](${mark.attrs.href})`;
      }
      return text;
    })
    .join("");
}

function blockToMarkdown(node: TiptapNode, indent = ""): string {
  switch (node.type) {
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${inlineToMarkdown(node.content)}`;
    case "paragraph":
      return indent + inlineToMarkdown(node.content).replace(/\n/g, `\n${indent}`);
    case "horizontalRule":
      return "---";
    case "blockquote":
      return (node.content ?? []).map((child) => blockToMarkdown(child)).join("\n\n").replace(/^/gm, "> ");
    case "bulletList":
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, position) => {
          const marker = node.type === "orderedList" ? `${start + position}. ` : "- ";
          const [first, ...rest] = item.content ?? [];
          const head = `${indent}${marker}${first ? inlineToMarkdown(first.content) : ""}`;
          const nested = rest.map((child) => blockToMarkdown(child, `${indent}  `));
          return [head, ...nested].join("\n");
        })
        .join("\n");
    }
    default:
      return node.text ?? inlineToMarkdown(node.content);
  }
}

/** Descrição para a IA ler. Texto que não é JSON do editor (cards antigos ou colados) volta como está. */
export function descriptionToMarkdown(description: string | null | undefined): string | null {
  if (!description) return null;
  try {
    const doc = JSON.parse(description) as TiptapNode;
    if (doc?.type !== "doc") return description;
    return (doc.content ?? []).map((block) => blockToMarkdown(block)).join("\n\n").trim();
  } catch {
    return description;
  }
}
