"use server";
import { graphFetch } from "./client";
import type { SendMessageResponse } from "./types";

// Mensagem interativa da Cloud API (spec 0079): até 3 botões de resposta ou uma lista de até
// 10 linhas. O clique volta no webhook como `interactive.button_reply` / `interactive.list_reply`
// com o mesmo `id` enviado aqui. Só vale dentro da janela de 24h.

const INTERACTIVE_LIMITS = {
  body: 1024,
  footer: 60,
  buttons: 3,
  buttonTitle: 20,
  listRows: 10,
  listButtonLabel: 20,
  rowTitle: 24,
  rowDescription: 72,
  optionId: 200,
} as const;

export interface InteractiveOption {
  id: string;
  title: string;
  /** Só aparece em lista. */
  description?: string;
}

export interface SendInteractiveInput {
  to: string;
  body: string;
  footer?: string;
  options: InteractiveOption[];
  /** Texto do botão que abre a lista. Ignorado quando as opções cabem em botões. */
  listButtonLabel?: string;
  replyToWamid?: string;
}

/** A Meta rejeita a mensagem inteira por um título longo; encurtar é melhor que perder a pergunta. */
function shorten(text: string, maxLength: number): string {
  const clean = text.trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function sendOfficialInteractive(
  accessToken: string,
  phoneNumberId: string,
  input: SendInteractiveInput,
): Promise<SendMessageResponse> {
  const options = input.options.slice(0, INTERACTIVE_LIMITS.listRows);
  if (options.length === 0) throw new Error("sendOfficialInteractive: sem opções.");

  const isButtons = options.length <= INTERACTIVE_LIMITS.buttons;
  const action = isButtons
    ? {
        buttons: options.map((option) => ({
          type: "reply",
          reply: { id: option.id, title: shorten(option.title, INTERACTIVE_LIMITS.buttonTitle) },
        })),
      }
    : {
        button: shorten(input.listButtonLabel ?? "Ver opções", INTERACTIVE_LIMITS.listButtonLabel),
        sections: [
          {
            rows: options.map((option) => ({
              id: option.id,
              title: shorten(option.title, INTERACTIVE_LIMITS.rowTitle),
              ...(option.description
                ? { description: shorten(option.description, INTERACTIVE_LIMITS.rowDescription) }
                : {}),
            })),
          },
        ],
      };

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "interactive",
    interactive: {
      type: isButtons ? "button" : "list",
      body: { text: shorten(input.body, INTERACTIVE_LIMITS.body) },
      ...(input.footer ? { footer: { text: shorten(input.footer, INTERACTIVE_LIMITS.footer) } } : {}),
      action,
    },
  };
  if (input.replyToWamid) body.context = { message_id: input.replyToWamid };

  return graphFetch<SendMessageResponse>(`/${phoneNumberId}/messages`, {
    method: "POST",
    accessToken,
    body,
  });
}
