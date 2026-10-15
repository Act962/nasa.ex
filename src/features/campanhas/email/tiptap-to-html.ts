// Spec 0107: corpo do modelo (JSON do editor TipTap) → HTML de email, no servidor e sem React.
// O `generateHTML` do `@tiptap/react` não carrega na camada de servidor do Next (o React de lá não tem
// `createContext`), e o disparo roda no Inngest. Cobre o que o editor do Órbita produz.

type TiptapMark = { type: string; attrs?: Record<string, unknown> };
type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
  content?: TiptapNode[];
};

const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^(https?:|mailto:|tel:)/i.test(value.trim()) ? value.trim() : null;
}

function alignStyle(node: TiptapNode): string {
  const align = node.attrs?.textAlign;
  return typeof align === "string" && ALIGNMENTS.has(align) && align !== "left" ? ` style="text-align:${align}"` : "";
}

function renderText(node: TiptapNode): string {
  let html = escapeHtml(node.text ?? "");
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") html = `<strong>${html}</strong>`;
    else if (mark.type === "italic") html = `<em>${html}</em>`;
    else if (mark.type === "underline") html = `<u>${html}</u>`;
    else if (mark.type === "strike") html = `<s>${html}</s>`;
    else if (mark.type === "code") html = `<code>${html}</code>`;
    else if (mark.type === "link") {
      const href = safeUrl(mark.attrs?.href);
      if (href) html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
    }
  }
  return html;
}

function renderChildren(node: TiptapNode): string {
  return (node.content ?? []).map(renderNode).join("");
}

function renderNode(node: TiptapNode): string {
  switch (node.type) {
    case "doc":
      return renderChildren(node);
    case "text":
      return renderText(node);
    case "paragraph":
      return `<p${alignStyle(node)}>${renderChildren(node) || "<br>"}</p>`;
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 1), 4);
      return `<h${level}${alignStyle(node)}>${renderChildren(node)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${renderChildren(node)}</ul>`;
    case "orderedList":
      return `<ol>${renderChildren(node)}</ol>`;
    case "listItem":
      return `<li>${renderChildren(node)}</li>`;
    case "blockquote":
      return `<blockquote>${renderChildren(node)}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${renderChildren(node)}</code></pre>`;
    case "hardBreak":
      return "<br>";
    case "horizontalRule":
      return "<hr>";
    case "image": {
      const src = safeUrl(node.attrs?.src);
      if (!src) return "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto">`;
    }
    default:
      return renderChildren(node);
  }
}

export function tiptapJsonToEmailHtml(bodyJson: unknown): string {
  const parsed: unknown = typeof bodyJson === "string" ? safeParse(bodyJson) : bodyJson;
  if (!parsed || typeof parsed !== "object") return "";
  return renderNode(parsed as TiptapNode);
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
