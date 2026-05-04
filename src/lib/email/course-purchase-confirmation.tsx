import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface CoursePurchaseConfirmationProps {
  email: string;
  courseTitle: string;
  planName: string;
  priceStars: number;
  amountBrl: number;
  creatorName: string;
  redeemLink: string;
  expiresInDays: number;
}

export const CoursePurchaseConfirmationEmail = ({
  email,
  courseTitle,
  planName,
  priceStars,
  amountBrl,
  creatorName,
  redeemLink,
  expiresInDays,
}: CoursePurchaseConfirmationProps) => {
  const previewText = `Compra confirmada — crie sua conta e acesse "${courseTitle}"`;
  const amountStr = amountBrl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-8 max-w-[520px] bg-white">
            <Heading className="text-[#0a0a0a] text-[26px] font-semibold text-center p-0 my-4 mx-0">
              Compra confirmada! 🎉
            </Heading>

            <Text className="text-[#0a0a0a] text-[15px] leading-[26px] text-center">
              Seu pagamento de <strong>{amountStr}</strong> foi recebido. Falta
              só um último passo: criar sua conta no{" "}
              <strong className="text-[#7c3aed]">N.A.S.A</strong> pra liberar o
              acesso ao curso.
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
                  <Text className="text-[#737373] text-[13px] m-0 mt-1">
                    {planName} · {priceStars.toLocaleString("pt-BR")} ★
                  </Text>
                  <Text className="text-[#737373] text-[12px] m-0 mt-2">
                    Por <strong>{creatorName}</strong>
                  </Text>
                </Column>
              </Row>
            </Section>

            <Section className="text-center mt-6 mb-4">
              <Button
                className="bg-[#7c3aed] rounded-lg text-white text-[14px] font-semibold no-underline text-center px-6 py-3"
                href={redeemLink}
              >
                Criar conta e acessar curso
              </Button>
            </Section>

            <Text className="text-[#525252] text-[13px] leading-6 text-center">
              Ou copie e cole esta URL no navegador:
            </Text>

            <Text className="text-center my-4">
              <Link
                href={redeemLink}
                className="text-[#7c3aed] no-underline text-[12px] break-all"
              >
                {redeemLink}
              </Link>
            </Text>

            <Hr className="border border-solid border-[#e5e5e5] my-6 mx-0 w-full" />

            <Text className="text-[#737373] text-[12px] leading-[22px]">
              <strong>Importante:</strong> este link é único, vinculado ao
              e-mail{" "}
              <span className="text-[#0a0a0a] font-medium">{email}</span> e
              expira em <strong>{expiresInDays} dias</strong>. Após criar a
              conta você cai direto no player do curso.
            </Text>

            <Text className="text-[#737373] text-[12px] leading-[22px]">
              Não foi você quem comprou? Ignore este e-mail — nenhuma conta será
              criada sem o link acima ser acessado.
            </Text>

            <Text className="text-[#a3a3a3] text-[11px] leading-5 text-center mt-6">
              © N.A.S.A. Todos os direitos reservados.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactCoursePurchaseConfirmationEmail(
  props: CoursePurchaseConfirmationProps,
) {
  return <CoursePurchaseConfirmationEmail {...props} />;
}
