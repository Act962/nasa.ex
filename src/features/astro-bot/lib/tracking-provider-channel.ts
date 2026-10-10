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
// Registra os adapters: fora da rota do webhook (Inngest, scripts) o canal ficava sem provider.
import "@/features/tracking-chat/lib/providers";
import { resolveOutboundProvider } from "@/features/tracking-chat/lib/providers/resolve-outbound-provider";
import type { WhatsappBotChannel, ButtonPayload } from "./types";
import { withListExtras } from "./menu/menu-flow";

const MAX_TEXT_LEN = 4000;
/** A Uazapi renderiza N botões, mas acima disto a leitura piora. */
const MAX_BUTTONS = 6;
/** Corpo de mensagem interativa da Meta: 1024 caracteres. */
const MAX_INTERACTIVE_BODY_LEN = 1024;
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
    options?: { isImmediate?: boolean },
  ): Promise<{ messageId: string | null }> {
    const resolved = await resolveOutboundProvider(this.trackingId);
    const chunks = chunkText(text);
    let lastId: string | null = null;
    for (let i = 0; i < chunks.length; i++) {
      // Delay próprio (Meta não tem o `delay` nativo do Uazapi); humaniza
      // respostas multi-chunk sem depender de flag provider-specific.
      if (!options?.isImmediate) await delay(humanDelayMs());
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
    // Em lista numerada só entram as opções que são resposta de verdade.
    const numberedButtons = payload.buttons.filter((button) => !button.interactiveOnly);

    // API oficial (spec 0079): botões até 3 opções, lista até 10. `ASTRO_BOT_INTERACTIVE=false`
    // desliga sem deploy; qualquer falha cai para o texto abaixo — pergunta nunca fica sem chegar.
    if (
      process.env.ASTRO_BOT_INTERACTIVE !== "false" &&
      resolved.provider.sendInteractive &&
      payload.buttons.length > 0
    ) {
      try {
        const options = withListExtras(payload.buttons);
        const isBodyTooLong = payload.bodyText.length > MAX_INTERACTIVE_BODY_LEN;
        if (isBodyTooLong) await this.sendText(phone, payload.bodyText, { isImmediate: payload.isImmediate });
        const result = await resolved.provider.sendInteractive({
          kind: "interactive",
          to: phone,
          body: isBodyTooLong ? "Escolha uma opção:" : payload.bodyText,
          footer: payload.footerText,
          options: options.map((button) => ({ id: button.id, title: button.text, description: button.description })),
          listButtonLabel: payload.listButtonLabel,
        });
        return { messageId: result.externalMessageId ?? null };
      } catch (error) {
        console.error("[astro-bot/channel] interativo da API oficial falhou, usando texto", error);
      }
    }

    // Botões ficam atrás de flag, desligados.
    //
    // Medido três vezes com esta instância: a Uazapi aceita o /send/menu e a
    // mensagem NÃO chega ao aparelho, enquanto texto puro chega sempre. O
    // preço do experimento é o pior possível — o Astro pergunta, o usuário
    // não vê nada, e o ciclo fica esperando resposta de uma pergunta
    // invisível. Lista numerada é feia e funciona.
    if (
      process.env.ASTRO_BOT_BUTTONS === "true" &&
      resolved.uazapiToken &&
      numberedButtons.length > 0
    ) {
      try {
        const { sendButtons } = await import("@/http/uazapi/send-menu");
        const response = await sendButtons(
          resolved.uazapiToken,
          {
            number: phone,
            text: payload.bodyText,
            footer: payload.footerText,
            buttons: numberedButtons.slice(0, MAX_BUTTONS).map((button) => ({ id: button.id, text: button.text })),
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
        if (messageId) return { messageId };
        console.error(
          "[astro-bot/channel] menu sem id, caindo para texto:",
          JSON.stringify(response).slice(0, 300),
        );
      } catch (error) {
        console.error("[astro-bot/channel] botões falharam, usando texto", error);
      }
    }

    const lines = numberedButtons.map(
      (button, index) => `*${index + 1}.* ${button.text}`,
    );
    const body = [payload.bodyText, ...lines, payload.footerText]
      .filter(Boolean)
      .join("\n");
    return this.sendText(phone, body, { isImmediate: payload.isImmediate });
  }

  async sendMedia(phone: string, media: { url: string; caption?: string }): Promise<{ messageId: string | null }> {
    const resolved = await resolveOutboundProvider(this.trackingId);
    const result = await resolved.provider.sendMedia({ kind: "media", to: phone, mediaKind: "image", mediaUrl: media.url, caption: media.caption });
    return { messageId: result.externalMessageId ?? null };
  }

  async sendVoice(phone: string, voice: { audio: Buffer; mimetype: string }): Promise<{ messageId: string | null }> {
    const resolved = await resolveOutboundProvider(this.trackingId);
    if (resolved.provider.uploadMedia) {
      // API oficial: sobe direto para a Meta, sem link público (spec 0083, RS-4).
      const uploaded = await resolved.provider.uploadMedia({ file: voice.audio, mimetype: voice.mimetype, fileName: "resposta.ogg" });
      const result = await resolved.provider.sendMedia({ kind: "media", to: phone, mediaKind: "audio", mediaId: uploaded.mediaId, mimetype: voice.mimetype, isVoice: true });
      return { messageId: result.externalMessageId ?? null };
    }
    if (!resolved.uazapiToken) throw new Error("Provider sem envio de nota de voz");
    const { sendMedia: sendUazapiMedia } = await import("@/http/uazapi/send-media");
    const response = await sendUazapiMedia(
      resolved.uazapiToken,
      { number: phone, type: "ptt", file: `data:${voice.mimetype};base64,${voice.audio.toString("base64")}` },
      resolved.uazapiBaseUrl,
    );
    const sent = response as { id?: unknown; messageid?: unknown };
    return { messageId: typeof sent?.messageid === "string" ? sent.messageid : typeof sent?.id === "string" ? sent.id : null };
  }

  async sendTyping(_phone: string, _durationMs: number): Promise<void> {
    // No-op: o delay humanizado em `sendText` já cobre o efeito de digitação.
    return;
  }
}
