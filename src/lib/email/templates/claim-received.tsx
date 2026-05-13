import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface ClaimReceivedEmailProps {
  creatorName: string;
  eventTitle: string;
  claimantName: string;
  claimantEmail: string;
  reason: string;
  responseUrl: string;
  expiresAt: Date | string;
}

/**
 * Email enviado pro criador do evento público quando alguém reivindica
 * a posse (uso indevido de marca, etc). Inclui magic-link que abre a
 * página de resposta SEM auth — criador clica e responde direto.
 */
export const ClaimReceivedEmail = ({
  creatorName,
  eventTitle,
  claimantName,
  claimantEmail,
  reason,
  responseUrl,
  expiresAt,
}: ClaimReceivedEmailProps) => {
  const expires =
    typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const previewText = `${claimantName} reivindica seu evento "${eventTitle}"`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[560px]">
            <Heading className="text-black text-[22px] font-semibold text-center p-0 my-[30px] mx-0">
              Reivindicação no evento "<strong>{eventTitle}</strong>"
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              Olá <strong>{creatorName}</strong>,
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              <strong>{claimantName}</strong> ({claimantEmail}) reivindicou o
              evento que você criou no Calendário Público.
            </Text>

            <Section className="bg-[#f7f7f7] border border-solid border-[#eaeaea] rounded p-[16px] my-[20px]">
              <Text className="text-[#555] text-[13px] leading-[20px] m-0">
                <strong>Motivo:</strong>
              </Text>
              <Text className="text-black text-[14px] leading-[20px] mt-[4px] mb-0 whitespace-pre-wrap">
                {reason}
              </Text>
            </Section>

            <Text className="text-black text-[14px] leading-[24px]">
              Você tem <strong>7 dias</strong> (até{" "}
              {expires.toLocaleDateString("pt-BR")}) pra responder:
            </Text>

            <Section className="text-center mt-[28px] mb-[28px]">
              <Button
                className="bg-black rounded text-white text-[14px] font-semibold no-underline text-center px-5 py-3"
                href={responseUrl}
              >
                Responder à reivindicação
              </Button>
            </Section>

            <Text className="text-[#555] text-[12px] leading-[20px]">
              Opções na página:
            </Text>
            <Text className="text-[#555] text-[12px] leading-[20px] mt-0">
              • <strong>Aceito</strong> — o evento será despublicado do
              Calendário Público.
              <br />• <strong>Rejeito</strong> — você justifica e a disputa
              vai pra admin decidir. O evento continua visível com aviso
              "ownership contestado" até a decisão.
            </Text>

            <Hr className="border border-solid border-[#eaeaea] my-[20px] mx-0 w-full" />

            <Text className="text-[#666666] text-[11px] leading-[18px]">
              Se você não responder em 7 dias, o evento será despublicado
              automaticamente. Esta é uma proteção pra marcas legítimas;
              você pode republicar manualmente depois caso julgue
              indevido.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ClaimReceivedEmail;
