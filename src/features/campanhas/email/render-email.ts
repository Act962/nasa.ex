// Spec 0107: corpo do modelo (TipTap) → HTML do email, com variáveis por destinatário e rodapé de descadastro.
import "server-only";
import { tiptapJsonToEmailHtml } from "./tiptap-to-html";
import { EMAIL_TEMPLATE_VARIABLES, type EmailVariableKey } from "./variables";

export type EmailRecipientContext = { name: string; email: string; orgName: string };

// Marcas trocadas por destinatário depois de renderizar o layout uma vez só.
const BODY_MARKER = "%%ORBITA_EMAIL_BODY%%";
const UNSUBSCRIBE_MARKER = "%%ORBITA_EMAIL_UNSUBSCRIBE%%";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function variableValue(key: EmailVariableKey, context: EmailRecipientContext): string {
  switch (key) {
    case "primeiro_nome":
      return context.name.trim().split(/\s+/)[0] ?? "";
    case "nome":
      return context.name.trim();
    case "email":
      return context.email;
    case "empresa":
      return context.orgName;
  }
}

export function applyEmailVariables(
  text: string,
  context: EmailRecipientContext,
  options: { isHtml: boolean },
): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, rawKey: string) => {
    const isKnown = EMAIL_TEMPLATE_VARIABLES.some((variable) => variable.key === rawKey);
    if (!isKnown) return match;
    const value = variableValue(rawKey as EmailVariableKey, context);
    return options.isHtml ? escapeHtml(value) : value;
  });
}

/** HTML do corpo do modelo, ainda com as variáveis `{{...}}` (o que fica congelado na campanha). */
export function templateBodyToHtml(bodyJson: unknown): string {
  return tiptapJsonToEmailHtml(bodyJson);
}

/**
 * Layout renderizado uma vez por campanha; `personalizeEmail` preenche cada destinatário. HTML puro com estilo
 * inline (o que os clientes de email entendem) e sem React: o `react-dom/server` do React Email não roda na
 * camada de servidor do Next, onde o disparo e o "enviar teste" executam.
 */
export async function renderCampaignLayout(input: { previewText: string; orgName: string }): Promise<string> {
  const preview = escapeHtml(input.previewText);
  const orgName = escapeHtml(input.orgName);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${preview}</title>
</head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;">
<tr><td align="center" style="padding:40px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;">
<tr><td style="padding:32px;color:#0a0a0a;font-size:15px;line-height:26px;">${BODY_MARKER}</td></tr>
<tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e5e5;margin:0;"></td></tr>
<tr><td style="padding:20px 32px 28px;color:#737373;font-size:12px;line-height:20px;text-align:center;">
Você recebeu este email de <strong>${orgName}</strong>. <a href="${UNSUBSCRIBE_MARKER}" style="color:#737373;text-decoration:underline;">Não quero mais receber</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function personalizeEmail(input: {
  layoutHtml: string;
  bodyHtml: string;
  subject: string;
  context: EmailRecipientContext;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const body = applyEmailVariables(input.bodyHtml, input.context, { isHtml: true });
  return {
    subject: applyEmailVariables(input.subject, input.context, { isHtml: false }),
    html: input.layoutHtml
      // Função como substituto: com string, "$&", "$'" e "$1" no texto do email seriam interpretados.
      .replace(BODY_MARKER, () => body)
      .replace(UNSUBSCRIBE_MARKER, () => escapeHtml(input.unsubscribeUrl)),
  };
}

export function resolveSenderAddress(orgName: string): string {
  const fromName = orgName.replace(/[<>"]/g, "").slice(0, 64);
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "noreply@notifications.nasaex.com";
  return `${fromName} <${fromAddress}>`;
}
