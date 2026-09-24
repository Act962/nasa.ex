import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface PaymentReminderEmailProps {
  organizationName: string;
  recipientName: string;
  message: string;
  entrySummary: { description: string; amountLabel: string; dueDateLabel: string } | null;
  attachmentFileName: string | null;
}

export const PaymentReminderEmail = ({
  organizationName,
  recipientName,
  message,
  entrySummary,
  attachmentFileName,
}: PaymentReminderEmailProps) => {
  const previewText = entrySummary
    ? `${organizationName}: ${entrySummary.description} — vence ${entrySummary.dueDateLabel}`
    : `Mensagem de ${organizationName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-8 max-w-[520px] bg-white">
            <Heading className="text-[#0a0a0a] text-[20px] font-semibold m-0 mb-4">
              {organizationName}
            </Heading>
            <Text className="text-[#0a0a0a] text-[15px] leading-[24px] m-0 mb-3">
              Olá, {recipientName}.
            </Text>
            <Text className="text-[#262626] text-[15px] leading-[24px] m-0 mb-5 whitespace-pre-line">
              {message}
            </Text>

            {entrySummary && (
              <Section className="bg-[#f5f3ff] border border-solid border-[#ddd6fe] rounded-xl p-5 my-4">
                <Text className="text-[#5b21b6] text-[10px] uppercase tracking-[2px] font-bold m-0 mb-2">
                  Resumo
                </Text>
                <Text className="text-[#0a0a0a] text-[15px] font-semibold m-0 mb-1">
                  {entrySummary.description}
                </Text>
                <Text className="text-[#404040] text-[14px] m-0">
                  Valor: <strong>{entrySummary.amountLabel}</strong> · Vencimento:{" "}
                  <strong>{entrySummary.dueDateLabel}</strong>
                </Text>
              </Section>
            )}

            {attachmentFileName && (
              <Text className="text-[#525252] text-[13px] leading-5 mt-4 mb-0">
                Documento anexo: <strong>{attachmentFileName}</strong>
              </Text>
            )}

            <Text className="text-[#a3a3a3] text-[11px] leading-5 text-center mt-8">
              Enviado por {organizationName} via ÓRBITA
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactPaymentReminderEmail(props: PaymentReminderEmailProps) {
  return <PaymentReminderEmail {...props} />;
}
