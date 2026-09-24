/**
 * TrackingProviderBotChannel — implementação `WhatsappBotChannel` que responde
 * o Astro pelo número da PRÓPRIA tracking, usando o provider ATIVO dela
 * (Uazapi ou WhatsApp Cloud/Meta).
 *
 * Em vez de uma instância dedicada, resolve o provider via
 * `resolveOutboundProvider(trackingId)` — o mesmo ponto que o chat de
 * atendimento usa pra mandar mensagem. Assim o Astro fica provider-agnóstico:
 * trocar o provider da tracking não exige tocar aqui.
 *
 * Humanização (chunk + delay) mantida do canal Uazapi anterior pra respostas
 * longas ficarem naturais.
 */
import "server-only";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import type { WhatsappBotChannel, ButtonPayload } from "./types";

const MAX_TEXT_LEN = 4000;
/** A Uazapi renderiza N botões, mas acima disto a leitura piora. */
const MAX_BUTTONS = 6;
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 4000;

function humanDelayMs(): number {
  return Math.floor(
    MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS),
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string): string[] {
  if (text.length <= MAX_TEXT_LEN) return [text];
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let buffer = "";
  for (const paragraph of paragraphs) {
    if ((buffer + "\n\n" + paragraph).length > MAX_TEXT_LEN) {
      if (buffer) chunks.push(buffer);
      if (paragraph.length > MAX_TEXT_LEN) {
        for (let i = 0; i < paragraph.length; i += MAX_TEXT_LEN) {
          chunks.push(paragraph.slice(i, i + MAX_TEXT_LEN));
        }
        buffer = "";
      } else {
        buffer = paragraph;
      }
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export class TrackingProviderBotChannel implements WhatsappBotChannel {
  constructor(private readonly trackingId: string) {}

  async sendText(
    phone: string,
    text: string,
  ): Promise<{ messageId: string | null }> {
    const resolved = await resolveOutboundProvider(this.trackingId);
    const chunks = chunkText(text);
    let lastId: string | null = null;
    for (let i = 0; i < chunks.length; i++) {
      // Delay próprio (Meta não tem o `delay` nativo do Uazapi); humaniza
      // respostas multi-chunk sem depender de flag provider-specific.
      await delay(humanDelayMs());
      const result = await resolved.provider.sendText({
        kind: "text",
        to: phone,
        body: chunks[i]!,
        markPreviousAsRead: i === 0,
      });
      lastId = result.externalMessageId ?? lastId;
    }
    return { messageId: lastId };
  }

  /**
   * Botões de verdade quando o provider é Uazapi; lista numerada quando não é.
   *
   * O degrade para texto era a regra antes porque o canal só lia insights e
   * não tinha o que oferecer. Com o ciclo guiado ("em qual conta?"), escolher
   * digitando é atrito puro — e o clique volta como `ButtonsResponseMessage`,
   * que o webhook agora entrega ao bot.
   */
  async sendButtons(
    phone: string,
    payload: ButtonPayload,
  ): Promise<{ messageId: string | null }> {
    const resolved = await resolveOutboundProvider(this.trackingId);

    if (resolved.uazapiToken && payload.buttons.length > 0) {
      try {
        const { sendButtons } = await import("@/http/uazapi/send-menu");
        const response = await sendButtons(
          resolved.uazapiToken,
          {
            number: phone,
            text: payload.bodyText,
            footer: payload.footerText,
            buttons: payload.buttons.slice(0, MAX_BUTTONS),
            readchat: true,
          },
          resolved.uazapiBaseUrl,
        );
        const sent = response as { id?: unknown; messageid?: unknown };
        const messageId =
          typeof sent?.id === "string"
            ? sent.id
            : typeof sent?.messageid === "string"
              ? sent.messageid
              : null;
        // Sem id a mensagem não saiu, mesmo com HTTP 200. Confiar no 200
        // fez a pergunta sumir: o Astro respondeu e o usuário não recebeu
        // nada — o pior dos dois mundos, porque o ciclo ficou esperando.
        if (messageId) return { messageId };
        console.error(
          "[astro-bot/channel] menu sem id, caindo para texto:",
          JSON.stringify(response).slice(0, 300),
        );
      } catch (error) {
        console.error("[astro-bot/channel] botões falharam, usando texto", error);
      }
    }

    const lines = payload.buttons.map(
      (button, index) => `${index + 1}. ${button.text}`,
    );
    const body = [payload.bodyText, ...lines, payload.footerText]
      .filter(Boolean)
      .join("\n");
    return this.sendText(phone, body);
  }

  async sendTyping(_phone: string, _durationMs: number): Promise<void> {
    // No-op: o delay humanizado em `sendText` já cobre o efeito de digitação.
    return;
  }
}
