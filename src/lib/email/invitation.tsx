import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface NasaInviteUserEmailProps {
  username?: string;
  invitedByUsername?: string;
  invitedByEmail?: string;
  teamName?: string;
  teamImage?: string;
  inviteLink?: string;
}

export const InviteUserEmail = ({
  username,
  invitedByUsername,
  invitedByEmail,
  teamName,
  teamImage,
  inviteLink,
}: NasaInviteUserEmailProps) => {
  const previewText = `Junte-se a ${invitedByUsername} no N.A.S.A`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-8 max-w-[500px] bg-white">
            <Heading className="text-[#0a0a0a] text-[28px] font-semibold text-center p-0 my-6 mx-0">
              Junte-se a{" "}
              <strong className="text-[#7c3aed]">{invitedByUsername}</strong> no{" "}
              <strong className="text-[#7c3aed]">N.A.S.A</strong>
            </Heading>

            <Text className="text-[#0a0a0a] text-[15px] leading-[26px]">
              Olá, {username}!
            </Text>

            <Text className="text-[#0a0a0a] text-[15px] leading-[26px]">
              <strong>{invitedByUsername}</strong> (
              <Link
                href={`mailto:${invitedByEmail}`}
                className="text-[#7c3aed] no-underline hover:underline"
              >
                {invitedByEmail}
              </Link>
              ) convidou você para a equipe <strong>{teamName}</strong> no{" "}
              <strong>N.A.S.A</strong>.
            </Text>

            {teamImage ? (
              <Section className="my-6">
                <Row>
                  <Column align="center">
                    <Img
                      className="rounded-full border-2 border-[#e5e5e5]"
                      src={teamImage}
                      width="80"
                      height="80"
                      alt={`Logo da equipe ${teamName}`}
                    />
                  </Column>
                </Row>
              </Section>
            ) : null}

            <Section className="text-center mt-8 mb-8">
              <Button
                className="bg-[#7c3aed] rounded-lg text-white text-[14px] font-semibold no-underline text-center px-6 py-3 hover:bg-[#6d28d9]"
                href={inviteLink}
              >
                Entrar na equipe
              </Button>
            </Section>

            <Text className="text-[#525252] text-[13px] leading-6 text-center">
              Ou copie e cole esta URL no seu navegador:
            </Text>

            <Text className="text-center my-4">
              <Link
                href={inviteLink}
                className="text-[#7c3aed] no-underline text-[13px] break-all hover:underline"
              >
                {inviteLink}
              </Link>
            </Text>

            <Hr className="border border-solid border-[#e5e5e5] my-8 mx-0 w-full" />

            <Text className="text-[#737373] text-[12px] leading-[22px] text-center">
              Este convite foi destinado a{" "}
              <span className="text-[#0a0a0a] font-medium">{username}</span>. Se
              você não estava esperando este convite, pode ignorar este e-mail.
            </Text>

            <Text className="text-[#a3a3a3] text-[11px] leading-6 text-center mt-6">
              © 2024 N.A.S.A. Todos os direitos reservados.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactInvitationEmail(props: NasaInviteUserEmailProps) {
  console.log(props);
  return <InviteUserEmail {...props} />;
}
