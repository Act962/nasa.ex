// Spec 0107: corpo do modelo (TipTap) → HTML do email, com variáveis por destinatário e rodapé de descadastro.
import "server-only";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  render,
} from "@react-email/components";
import { convertJsonToHtml } from "@/lib/json-to-html";
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

function CampaignEmailLayout({ previewText, orgName }: { previewText: string; orgName: string }) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-8 max-w-[560px] bg-white">
            <Section className="text-[#0a0a0a] text-[15px] leading-[26px]">{BODY_MARKER}</Section>
            <Hr className="border border-solid border-[#e5e5e5] my-6 mx-0 w-full" />
            <Text className="text-[#737373] text-[12px] leading-[20px] text-center">
              Você recebeu este email de <strong>{orgName}</strong>.{" "}
              <Link href={UNSUBSCRIBE_MARKER} className="text-[#737373] underline">
                Não quero mais receber
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

/** HTML do corpo do modelo, ainda com as variáveis `{{...}}` (o que fica congelado na campanha). */
export function templateBodyToHtml(bodyJson: unknown): string {
  return convertJsonToHtml(bodyJson as Parameters<typeof convertJsonToHtml>[0]);
}

/** Layout renderizado uma vez por campanha; `personalizeEmail` preenche cada destinatário. */
export async function renderCampaignLayout(input: { previewText: string; orgName: string }) {
  return render(<CampaignEmailLayout previewText={input.previewText} orgName={input.orgName} />);
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
      .replace(BODY_MARKER, body)
      .replace(UNSUBSCRIBE_MARKER, escapeHtml(input.unsubscribeUrl)),
  };
}

export function resolveSenderAddress(orgName: string): string {
  const fromName = orgName.replace(/[<>"]/g, "").slice(0, 64);
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "noreply@notifications.nasaex.com";
  return `${fromName} <${fromAddress}>`;
}
