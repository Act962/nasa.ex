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

interface TrafegoPurchaseConfirmationProps {
  email: string;
  planName: string;
  platformLabel: string;
  objectiveLabel: string;
  adBudgetBrl: number;
  serviceFeePercent: number;
  serviceFeeBrl: number;
  setupFeeBrl: number;
  totalBrl: number;
  durationDays: number;
  activationLink: string;
  expiresInDays: number;
}

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const TrafegoPurchaseConfirmationEmail = ({
  email,
  planName,
  platformLabel,
  objectiveLabel,
  adBudgetBrl,
  serviceFeePercent,
  serviceFeeBrl,
  setupFeeBrl,
  totalBrl,
  durationDays,
  activationLink,
  expiresInDays,
}: TrafegoPurchaseConfirmationProps) => (
  <Html>
    <Head />
    <Preview>{`Pagamento confirmado — ative sua campanha ${planName}`}</Preview>
    <Tailwind>
      <Body className="bg-[#0a0a0a] font-sans py-[40px]">
        <Container className="bg-[#141414] border border-solid border-[#262626] rounded-[16px] px-[32px] py-[32px] max-w-[520px] mx-auto">
          <Text className="text-[#22c55e] text-[13px] font-semibold m-0">
            ✓ Pagamento confirmado
          </Text>

          <Heading className="text-white text-[24px] font-bold mt-[8px] mb-[8px] p-0">
            Falta um passo para sua campanha começar
          </Heading>

          <Text className="text-[#a3a3a3] text-[14px] leading-[24px] mt-0">
            Crie sua senha para acessar o painel, enviar os criativos e escolher a
            copy. Nossa equipe cuida do resto.
          </Text>

          <Section className="bg-[#1c1c1c] rounded-[12px] px-[20px] py-[16px] my-[24px]">
            <Text className="text-white text-[15px] font-semibold m-0">
              {planName}
            </Text>
            <Text className="text-[#a3a3a3] text-[13px] leading-[20px] mt-[4px] mb-[12px]">
              {platformLabel} · {objectiveLabel} · {durationDays} dias
            </Text>

            <Hr className="border border-solid border-[#262626] my-[12px]" />

            <Row>
              <Column>
                <Text className="text-[#a3a3a3] text-[13px] m-0">
                  Verba de tráfego
                </Text>
              </Column>
              <Column align="right">
                <Text className="text-white text-[13px] m-0">{brl(adBudgetBrl)}</Text>
              </Column>
            </Row>
            <Row>
              <Column>
                <Text className="text-[#a3a3a3] text-[13px] m-0">
                  {`Serviço Órbita (${serviceFeePercent}%)`}
                </Text>
              </Column>
              <Column align="right">
                <Text className="text-white text-[13px] m-0">
                  {brl(serviceFeeBrl)}
                </Text>
              </Column>
            </Row>

            {setupFeeBrl > 0 && (
              <Row>
                <Column>
                  <Text className="text-[#a3a3a3] text-[13px] m-0">
                    Setup da conta de anúncios
                  </Text>
                </Column>
                <Column align="right">
                  <Text className="text-white text-[13px] m-0">
                    {brl(setupFeeBrl)}
                  </Text>
                </Column>
              </Row>
            )}

            <Hr className="border border-solid border-[#262626] my-[12px]" />

            <Row>
              <Column>
                <Text className="text-white text-[14px] font-semibold m-0">
                  Total pago
                </Text>
              </Column>
              <Column align="right">
                <Text className="text-white text-[14px] font-semibold m-0">
                  {brl(totalBrl)}
                </Text>
              </Column>
            </Row>
          </Section>

          <Section className="text-center my-[28px]">
            <Button
              href={activationLink}
              className="bg-[#7c3aed] rounded-[10px] text-white text-[15px] font-semibold no-underline px-[28px] py-[14px]"
            >
              Ativar minha conta
            </Button>
          </Section>

          <Text className="text-[#737373] text-[12px] leading-[20px] text-center">
            Link válido por {expiresInDays} dias, para <strong>{email}</strong>.
          </Text>

          <Hr className="border border-solid border-[#262626] my-[24px]" />

          <Text className="text-[#737373] text-[12px] leading-[22px]">
            Não foi você quem comprou? Ignore este e-mail — nenhuma conta é criada
            sem o link acima ser acessado.
          </Text>

          <Text className="text-[#a3a3a3] text-[11px] leading-5 text-center mt-[24px]">
            © N.A.S.A. Todos os direitos reservados.
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export function reactTrafegoPurchaseConfirmationEmail(
  props: TrafegoPurchaseConfirmationProps,
) {
  return <TrafegoPurchaseConfirmationEmail {...props} />;
}
