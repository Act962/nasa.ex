import dayjs from "dayjs";
import { jsPDF } from "jspdf";

/** Uma mensagem no formato devolvido por `message.export` (campos mínimos). */
export interface ExportMessage {
  body: string | null;
  fromMe: boolean;
  senderName: string | null;
  createdAt: Date | string;
  mediaType: string | null;
  mediaCaption: string | null;
  mimetype: string | null;
  fileName: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ConversationExport {
  leadName: string;
  organizationName: string;
  total: number;
  truncated: boolean;
  messages: ExportMessage[];
}

export type ExportFormat = "pdf" | "txt";

function authorLabel(message: ExportMessage, leadName: string): string {
  if (message.fromMe) return message.senderName?.trim() || "Atendente";
  return message.senderName?.trim() || leadName || "Cliente";
}

/**
 * Representa a mídia como marcador textual, no estilo do export nativo do
 * WhatsApp — não embutimos o arquivo. A legenda (quando há) vem depois.
 */
function mediaPlaceholder(message: ExportMessage): string | null {
  const type = (message.mediaType || "").toLowerCase();
  const mime = (message.mimetype || "").toLowerCase();

  if (type.includes("image") || mime.startsWith("image/")) return "[Imagem]";
  if (type.includes("video") || mime.startsWith("video/")) return "[Vídeo]";
  if (type.includes("audio") || mime.startsWith("audio/")) return "[Áudio]";
  if (type === "location" || message.latitude != null) {
    if (message.latitude != null && message.longitude != null) {
      return `[Localização: ${message.latitude}, ${message.longitude}]`;
    }
    return "[Localização]";
  }
  if (type === "contact") return "[Contato]";
  if (type === "document" || message.fileName || mime) {
    return message.fileName ? `[Documento: ${message.fileName}]` : "[Documento]";
  }
  return null;
}

/** Texto do corpo de uma mensagem (marcador de mídia + legenda + texto). */
export function messageContent(message: ExportMessage): string {
  const parts: string[] = [];
  const media = mediaPlaceholder(message);
  if (media) parts.push(media);

  const caption = message.mediaCaption?.trim();
  if (caption) parts.push(caption);

  const text = message.body?.trim();
  if (text) parts.push(text);

  return parts.length > 0 ? parts.join(" ") : "[mensagem vazia]";
}

/**
 * Linha por mensagem no formato do WhatsApp: `[dd/mm/aaaa hh:mm] Autor: conteúdo`.
 * Base compartilhada entre o TXT e o PDF.
 */
export function transcriptLines(
  data: Pick<ConversationExport, "leadName" | "messages">,
): string[] {
  return data.messages.map((message) => {
    const time = dayjs(message.createdAt).format("DD/MM/YYYY HH:mm");
    const author = authorLabel(message, data.leadName);
    return `[${time}] ${author}: ${messageContent(message)}`;
  });
}

function fileBaseName(data: ConversationExport): string {
  const slug = (data.leadName || "conversa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 48);
  return `conversa-${slug || "lead"}-${dayjs().format("YYYYMMDD-HHmm")}`;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildHeader(data: ConversationExport): string[] {
  const header = [
    `Conversa com ${data.leadName}`,
    data.organizationName,
    `Exportado em ${dayjs().format("DD/MM/YYYY HH:mm")} — ${data.total} mensagens`,
  ];
  if (data.truncated) {
    header.push(
      `(Export limitado às ${data.messages.length} mensagens mais recentes)`,
    );
  }
  return header;
}

function exportTxt(data: ConversationExport): void {
  const content = [
    ...buildHeader(data),
    "",
    ...transcriptLines(data),
    "",
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
  triggerDownload(blob, `${fileBaseName(data)}.txt`);
}

// Caracteres do Windows-1252 fora do Latin-1 que a Helvetica padrão desenha
// (aspas curvas, travessões, reticências, marcador, euro...).
const CP1252_EXTRA_CHARS = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""),
);

function isDrawableByStandardFont(char: string): boolean {
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint === 0x0a) return true;
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true;
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true;
  return CP1252_EXTRA_CHARS.has(char);
}

/**
 * A fonte padrão do jsPDF só codifica Windows-1252. Um único caractere fora
 * dela (emoji, por exemplo) faz o jsPDF gravar a linha inteira em 2 bytes:
 * as letras saem espaçadas e o emoji vira lixo. Por isso o PDF recebe só o
 * que a fonte desenha; acentos do português ficam, emojis saem.
 */
export function toPdfSafeText(text: string): string {
  return Array.from(text.normalize("NFC"))
    .filter(isDrawableByStandardFont)
    .join("")
    .replace(/[  ]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

const PDF_COLORS = {
  text: [33, 33, 33],
  muted: [125, 125, 125],
  rule: [220, 220, 220],
  agent: [0, 105, 92],
  customer: [37, 70, 160],
} as const satisfies Record<string, readonly [number, number, number]>;

type PdfColor = (typeof PDF_COLORS)[keyof typeof PDF_COLORS];

/** Monta o PDF da conversa: dia como separador, autor em destaque, hora à direita. */
export function buildConversationPdf(data: ConversationExport): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  const bodyIndent = 10;
  const timeColumnWidth = 44;
  const bodyWidth = contentWidth - bodyIndent - timeColumnWidth;
  const bodyLineHeight = 14;
  let cursorY = marginTop;

  const setStyle = (fontSize: number, bold: boolean, color: PdfColor) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height <= pageHeight - marginBottom) return;
    doc.addPage();
    cursorY = marginTop;
  };

  const leadName = toPdfSafeText(data.leadName) || "Cliente";
  const [, ...subtitles] = buildHeader(data);

  setStyle(16, true, PDF_COLORS.text);
  const titleLines = doc.splitTextToSize(
    `Conversa com ${leadName}`,
    contentWidth,
  ) as string[];
  for (const line of titleLines) {
    doc.text(line, marginX, cursorY);
    cursorY += 20;
  }
  setStyle(9, false, PDF_COLORS.muted);
  for (const subtitle of subtitles) {
    doc.text(toPdfSafeText(subtitle), marginX, cursorY);
    cursorY += 13;
  }
  cursorY += 4;
  const [ruleRed, ruleGreen, ruleBlue] = PDF_COLORS.rule;
  doc.setDrawColor(ruleRed, ruleGreen, ruleBlue);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  cursorY += 18;

  let previousDay: string | null = null;
  let previousAuthor: string | null = null;

  for (const message of data.messages) {
    const createdAt = dayjs(message.createdAt);
    const day = createdAt.format("DD/MM/YYYY");
    const author = toPdfSafeText(authorLabel(message, leadName)) || "Cliente";
    const rawContent = messageContent(message);
    // Mensagem que era só emoji fica vazia depois da limpeza.
    const content = toPdfSafeText(rawContent) || "[emoji]";

    setStyle(10, false, PDF_COLORS.text);
    const bodyLines = doc.splitTextToSize(content, bodyWidth) as string[];
    const isNewDay = day !== previousDay;
    const isNewAuthor = isNewDay || author !== previousAuthor;

    if (isNewDay) {
      ensureSpace(28 + 16 + bodyLineHeight);
      if (previousDay !== null) cursorY += 6;
      setStyle(8.5, true, PDF_COLORS.muted);
      doc.text(day, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 20;
    }

    if (isNewAuthor) {
      ensureSpace(16 + bodyLineHeight);
      if (!isNewDay) cursorY += 6;
      setStyle(
        9.5,
        true,
        message.fromMe ? PDF_COLORS.agent : PDF_COLORS.customer,
      );
      doc.text(author, marginX, cursorY);
      cursorY += 14;
    }

    bodyLines.forEach((line, lineIndex) => {
      ensureSpace(bodyLineHeight);
      setStyle(10, false, PDF_COLORS.text);
      doc.text(line, marginX + bodyIndent, cursorY);
      if (lineIndex === 0) {
        setStyle(8.5, false, PDF_COLORS.muted);
        doc.text(createdAt.format("HH:mm"), pageWidth - marginX, cursorY, {
          align: "right",
        });
      }
      cursorY += bodyLineHeight;
    });
    cursorY += 3;

    previousDay = day;
    previousAuthor = author;
  }

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    doc.setPage(pageNumber);
    setStyle(8, false, PDF_COLORS.muted);
    doc.text(
      `${leadName}  ·  Página ${pageNumber} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 28,
      { align: "center" },
    );
  }

  return doc;
}

function exportPdf(data: ConversationExport): void {
  buildConversationPdf(data).save(`${fileBaseName(data)}.pdf`);
}

/** Dispara o download da conversa no formato escolhido. */
export function downloadConversation(
  data: ConversationExport,
  format: ExportFormat,
): void {
  if (format === "txt") return exportTxt(data);
  return exportPdf(data);
}
