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

function exportPdf(data: ConversationExport): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - marginX * 2;
  const lineHeight = 15;
  let cursorY = marginTop;

  const addWrapped = (text: string, fontSize: number, bold: boolean) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const wrapped = doc.splitTextToSize(text, contentWidth) as string[];
    for (const line of wrapped) {
      if (cursorY > pageHeight - marginBottom) {
        doc.addPage();
        cursorY = marginTop;
      }
      doc.text(line, marginX, cursorY);
      cursorY += lineHeight;
    }
  };

  const [title, ...subtitles] = buildHeader(data);
  addWrapped(title, 14, true);
  for (const subtitle of subtitles) addWrapped(subtitle, 9, false);
  cursorY += lineHeight / 2;

  for (const line of transcriptLines(data)) {
    addWrapped(line, 10, false);
  }

  doc.save(`${fileBaseName(data)}.pdf`);
}

/** Dispara o download da conversa no formato escolhido. */
export function downloadConversation(
  data: ConversationExport,
  format: ExportFormat,
): void {
  if (format === "txt") return exportTxt(data);
  return exportPdf(data);
}
