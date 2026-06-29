/**
 * UazapiBotChannel — implementação `WhatsappBotChannel` via uazapi não-oficial.
 *
 * Usado pelo Earth tier do Astro Bot. Cada org tem uma `WhatsAppInstance`
 * DEDICADA (separada da instância de atendimento) — quando essa instância
 * recebe ban, atendimento ao cliente segue intacto.
 *
 * Humanização built-in (mitigação anti-ban):
 *   - delay aleatório 1.5-4s antes de cada `sendText` (configurável)
 *   - quebra mensagens longas (>4000 chars) em chunks
 *   - typing indicator quando explicitamente pedido
 *
 * NÃO trata auth nem rate limit — isso fica nas camadas acima.
 */
import "server-only";
import { sendText } from "@/http/uazapi/send-text";
import { sendMenu } from "@/http/uazapi/send-menu";
import type { WhatsappBotChannel, ButtonPayload } from "./types";

const MAX_TEXT_LEN = 4000;
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 4000;

function humanDelayMs(): number {
  return Math.floor(
    MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS),
  );
}

function chunkText(text: string): string[] {
  if (text.length <= MAX_TEXT_LEN) return [text];
  // Quebra por parágrafo, respeitando limite. Se 1 parágrafo > LIM, fatia
  // no espaço em branco mais próximo.
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > MAX_TEXT_LEN) {
      if (buf) chunks.push(buf);
      if (p.length > MAX_TEXT_LEN) {
        // Parágrafo gigante — quebra forçada
        for (let i = 0; i < p.length; i += MAX_TEXT_LEN) {
          chunks.push(p.slice(i, i + MAX_TEXT_LEN));
        }
        buf = "";
      } else {
        buf = p;
      }
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export class UazapiBotChannel implements WhatsappBotChannel {
  constructor(
    private readonly token: string,
    private readonly baseUrl?: string,
  ) {}

  async sendText(
    phone: string,
    text: string,
  ): Promise<{ messageId: string | null }> {
    const chunks = chunkText(text);
    let lastId: string | null = null;
    for (let i = 0; i < chunks.length; i++) {
      const result = await sendText(
        this.token,
        {
          number: phone,
          text: chunks[i]!,
          // Delay próprio + delay uazapi (typing indicator visível pro user).
          delay: humanDelayMs(),
          readmessages: i === 0, // marca como lida na 1ª mensagem
        },
        this.baseUrl,
      );
      lastId = result?.id ?? lastId;
    }
    return { messageId: lastId };
  }

  async sendButtons(
    phone: string,
    payload: ButtonPayload,
  ): Promise<{ messageId: string | null }> {
    const result = await sendMenu(
      this.token,
      {
        number: phone,
        type: "button",
        text: payload.bodyText,
        footerText: payload.footerText,
        choices: payload.buttons.map((b) => `${b.id}|${b.text}`),
        delay: humanDelayMs(),
        readmessages: true,
      },
      this.baseUrl,
    );
    return { messageId: result?.id ?? null };
  }

  async sendTyping(_phone: string, _durationMs: number): Promise<void> {
    // uazapi não tem endpoint dedicado pra typing indicator — o `delay`
    // do sendText já gera typing automaticamente. Implementação no-op
    // por design; substituir quando migrar pra Meta Cloud API.
    return;
  }
}
