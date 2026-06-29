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

/**
 * Email com OTP de 6 dígitos pra vincular WhatsApp ao Astro Bot.
 *
 * Visual minimalista (não-comemorativo) pra reforçar que é código de
 * segurança. Expira em 10 min, OTP só serve pra vincular esse phone.
 */
export interface AstroBotOtpEmailProps {
  userName: string;
  phoneE164: string;
  otp: string;
  expiresInMinutes: number;
}

export const AstroBotOtpEmail = ({
  userName,
  phoneE164,
  otp,
  expiresInMinutes,
}: AstroBotOtpEmailProps) => {
  const previewText = `Código ${otp} pra vincular WhatsApp ao Astro`;
  const formattedPhone = phoneE164.startsWith("+")
    ? phoneE164
    : `+${phoneE164}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-8 max-w-[480px] bg-white">
            <Heading className="text-[#0a0a0a] text-[22px] font-semibold m-0 mb-4">
              Vincular WhatsApp ao Astro
            </Heading>
            <Text className="text-[#0a0a0a] text-[15px] leading-[24px] m-0 mb-3">
              Oi {userName}, você está vinculando o número{" "}
              <strong>{formattedPhone}</strong> pra conversar com o Astro pelo
              WhatsApp.
            </Text>
            <Text className="text-[#525252] text-[14px] leading-[22px] m-0 mb-6">
              Use este código no NASA pra confirmar:
            </Text>

            <Section className="bg-[#f5f3ff] border border-solid border-[#ddd6fe] rounded-xl p-5 text-center my-4">
              <Text className="text-[#5b21b6] text-[10px] uppercase tracking-[2px] font-bold m-0 mb-2">
                Seu código
              </Text>
              <Text className="text-[#0a0a0a] text-[36px] font-bold tracking-[6px] m-0 font-mono">
                {otp}
              </Text>
            </Section>

            <Text className="text-[#737373] text-[12px] leading-5 mt-6 mb-0">
              Expira em <strong>{expiresInMinutes} minutos</strong>. Se você
              não fez esse pedido, ignore — nada será vinculado sem o código.
            </Text>

            <Text className="text-[#a3a3a3] text-[11px] leading-5 text-center mt-8">
              © N.A.S.A.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactAstroBotOtpEmail(props: AstroBotOtpEmailProps) {
  return <AstroBotOtpEmail {...props} />;
}
