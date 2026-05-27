import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface PurchaseDefaultEmailProps {
  studentName: string;
  courseTitle: string;
  creatorName: string;
  orgName: string;
  planName: string | null;
  amountBrl: number | null;
  accessUrl: string;
}

export const PurchaseDefaultEmail = ({
  studentName,
  courseTitle,
  creatorName,
  orgName,
  planName,
  amountBrl,
  accessUrl,
}: PurchaseDefaultEmailProps) => {
  const previewText = `Bem-vindo(a) ao curso ${courseTitle}!`;
  const amountStr =
    amountBrl != null && amountBrl > 0
      ? amountBrl.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : null;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-8 max-w-[520px] bg-white">
            <Heading className="text-[#0a0a0a] text-[24px] font-semibold p-0 my-4 mx-0">
              Olá, {studentName}! 👋
            </Heading>

            <Text className="text-[#0a0a0a] text-[15px] leading-[26px]">
              Sua matrícula em <strong>{courseTitle}</strong> foi confirmada.
              Você já pode acessar o conteúdo a qualquer momento — basta clicar
              no botão abaixo.
            </Text>

            <Section className="bg-[#f5f3ff] rounded-lg p-4 my-6">
              <Row>
                <Column>
                  <Text className="text-[#525252] text-[12px] uppercase tracking-wider mb-1 font-semibold">
                    Curso
                  </Text>
                  <Text className="text-[#0a0a0a] text-[16px] font-semibold m-0">
                    {courseTitle}
                  </Text>
                  {planName ? (
                    <Text className="text-[#737373] text-[13px] m-0 mt-1">
                      Plano: {planName}
                      {amountStr ? ` · ${amountStr}` : ""}
                    </Text>
                  ) : null}
                  <Text className="text-[#737373] text-[12px] m-0 mt-2">
                    Por <strong>{creatorName}</strong>
                  </Text>
                </Column>
              </Row>
            </Section>

            <Section className="text-center mt-6 mb-4">
              <Button
                className="bg-[#7c3aed] rounded-lg text-white text-[14px] font-semibold no-underline text-center px-6 py-3"
                href={accessUrl}
              >
                Acessar o curso
              </Button>
            </Section>

            <Hr className="border border-solid border-[#e5e5e5] my-6 mx-0 w-full" />

            <Text className="text-[#737373] text-[12px] leading-[22px] text-center">
              Enviado por <strong>{orgName}</strong> via N.A.S.A. Route.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactPurchaseDefaultEmail(props: PurchaseDefaultEmailProps) {
  return <PurchaseDefaultEmail {...props} />;
}
