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

interface TrafegoStatusUpdateProps {
  clientName: string;
  orderCode: string;
  statusTitle: string;
  body: string;
  panelUrl: string;
}

/** Aviso de mudança de fase da campanha — um por status com copy definida. */
export const TrafegoStatusUpdateEmail = ({
  clientName,
  orderCode,
  statusTitle,
  body,
  panelUrl,
}: TrafegoStatusUpdateProps) => (
  <Html>
    <Head />
    <Preview>{`${orderCode} · ${statusTitle}`}</Preview>
    <Tailwind>
      <Body className="bg-[#0a0a0a] font-sans py-[40px]">
        <Container className="bg-[#141414] border border-solid border-[#262626] rounded-[16px] px-[32px] py-[32px] max-w-[520px] mx-auto">
          <Text className="text-[#a78bfa] text-[13px] font-semibold m-0">
            trafeGO · {orderCode}
          </Text>

          <Heading className="text-white text-[24px] font-bold mt-[8px] mb-[8px] p-0">
            {statusTitle}
          </Heading>

          {body.split("\n\n").map((paragraph, index) => (
            <Text
              key={index}
              className="text-[#a3a3a3] text-[14px] leading-[24px] mt-0 whitespace-pre-line"
            >
              {paragraph}
            </Text>
          ))}

          <Section className="text-center my-[28px]">
            <Button
              href={panelUrl}
              className="bg-[#7c3aed] rounded-[10px] text-white text-[15px] font-semibold no-underline px-[28px] py-[14px]"
            >
              Abrir meu painel
            </Button>
          </Section>

          <Hr className="border border-solid border-[#262626] my-[24px]" />

          <Text className="text-[#737373] text-[12px] leading-[22px]">
            Este aviso foi enviado para {clientName} porque há uma campanha trafeGO em
            andamento. Dúvidas? Responda pelo painel ou pelo WhatsApp da equipe.
          </Text>

          <Text className="text-[#a3a3a3] text-[11px] leading-5 text-center mt-[24px]">
            © ÓRBITA Todos os direitos reservados.
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export function reactTrafegoStatusUpdateEmail(props: TrafegoStatusUpdateProps) {
  return <TrafegoStatusUpdateEmail {...props} />;
}
