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

interface ClaimResolutionEmailProps {
  claimantName: string;
  eventTitle: string;
  decision: "ACCEPT" | "REJECT";
  creatorResponse: string | null;
  eventUrl: string;
}

/**
 * Email pro reivindicante após criador responder. Cobre os 2 cenários:
 *  - ACCEPT: criador aceitou, evento foi despublicado.
 *  - REJECT: criador contestou, disputa foi pra admin.
 */
export const ClaimResolutionEmail = ({
  claimantName,
  eventTitle,
  decision,
  creatorResponse,
  eventUrl,
}: ClaimResolutionEmailProps) => {
  const accepted = decision === "ACCEPT";
  const previewText = accepted
    ? `Reivindicação aceita — "${eventTitle}"`
    : `Criador contestou sua reivindicação`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[560px]">
            <Heading className="text-black text-[22px] font-semibold text-center p-0 my-[30px] mx-0">
              {accepted
                ? "Reivindicação aceita"
                : "Criador contestou sua reivindicação"}
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              Olá <strong>{claimantName}</strong>,
            </Text>

            {accepted ? (
              <>
                <Text className="text-black text-[14px] leading-[24px]">
                  O criador do evento <strong>"{eventTitle}"</strong> aceitou
                  sua reivindicação. O evento foi <strong>despublicado</strong>{" "}
                  do Calendário Público.
                </Text>
                <Text className="text-black text-[14px] leading-[24px]">
                  Se quiser republicar este evento sob sua marca, crie um
                  novo evento público no Calendário.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-black text-[14px] leading-[24px]">
                  O criador do evento <strong>"{eventTitle}"</strong>{" "}
                  contestou sua reivindicação. O evento foi marcado como{" "}
                  <strong>"ownership contestado"</strong> publicamente até
                  que nossa equipe analise.
                </Text>
                {creatorResponse && (
                  <Section className="bg-[#fff8e6] border border-solid border-[#f3c623] rounded p-[14px] my-[16px]">
                    <Text className="text-[#7a5a00] text-[12px] font-semibold m-0">
                      Justificativa do criador:
                    </Text>
                    <Text className="text-[#7a5a00] text-[13px] leading-[20px] mt-[4px] mb-0 whitespace-pre-wrap">
                      "{creatorResponse}"
                    </Text>
                  </Section>
                )}
                <Text className="text-black text-[14px] leading-[24px]">
                  Nosso time vai revisar e decidir nos próximos dias.
                  Você receberá outro email com a decisão.
                </Text>
              </>
            )}

            <Section className="text-center mt-[28px] mb-[28px]">
              <Button
                className="bg-black rounded text-white text-[14px] font-semibold no-underline text-center px-5 py-3"
                href={eventUrl}
              >
                Ver evento
              </Button>
            </Section>

            <Hr className="border border-solid border-[#eaeaea] my-[20px] mx-0 w-full" />

            <Text className="text-[#666666] text-[11px] leading-[18px]">
              Você está recebendo este email porque submeteu uma
              reivindicação no Calendário Público NASA.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ClaimResolutionEmail;
