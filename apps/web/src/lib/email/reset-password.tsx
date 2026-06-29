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
  Tailwind,
  Text,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  username?: string;
  resetLink?: string;
  appName?: string;
  expirationMinutes?: string;
}

export const ResetPasswordEmail = ({
  username,
  resetLink,
  appName = "NASA.ex",
  expirationMinutes = "60",
}: ResetPasswordEmailProps) => {
  const previewText = `Recupere o acesso à sua conta no ${appName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-[#fafafa] px-2 font-sans">
          <Container className="mx-auto my-10 max-w-[520px] rounded-lg border border-solid border-[#e5e5e5] bg-white p-8">
            <Heading className="my-6 p-0 text-center text-[28px] font-semibold text-[#0a0a0a]">
              Redefina sua senha no{" "}
              <strong className="text-[#7c3aed]">{appName}</strong>
            </Heading>

            <Text className="text-[15px] leading-[26px] text-[#0a0a0a]">
              Olá{username ? `, ${username}` : ""}!
            </Text>

            <Text className="text-[15px] leading-[26px] text-[#0a0a0a]">
              Recebemos uma solicitação para redefinir a senha da sua conta.
              Clique no botão abaixo para criar uma nova senha.
            </Text>

            <div className="my-8 text-center">
              <Button
                className="rounded-lg bg-[#7c3aed] px-6 py-3 text-center text-[14px] font-semibold text-white no-underline"
                href={resetLink}
              >
                Redefinir senha
              </Button>
            </div>

            <Text className="text-center text-[13px] leading-6 text-[#525252]">
              Ou copie e cole esta URL no navegador:
            </Text>

            <Text className="my-4 text-center">
              <Link
                href={resetLink}
                className="break-all text-[13px] text-[#7c3aed] no-underline"
              >
                {resetLink}
              </Link>
            </Text>

            <Hr className="my-8 w-full border border-solid border-[#e5e5e5]" />

            <Text className="text-center text-[12px] leading-[22px] text-[#737373]">
              Este link expira em aproximadamente {expirationMinutes} minutos.
              Se você não solicitou essa alteração, pode ignorar este e-mail.
            </Text>

            <Text className="mt-6 text-center text-[11px] leading-5 text-[#a3a3a3]">
              © 2026 {appName}. Todos os direitos reservados.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactResetPasswordEmail(props: ResetPasswordEmailProps) {
  return <ResetPasswordEmail {...props} />;
}
