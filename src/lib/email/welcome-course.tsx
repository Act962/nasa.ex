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

/**
 * Email de boas-vindas quando o lead vira aluno NASA Route (pagou ou recebeu
 * acesso a curso gratuito). Disparado pelo workflow agent-mode
 * "Boas-vindas NASA Route" via SEND_EMAIL executor (template="welcome-course").
 *
 * Caprichado: hero roxo, badge do plano, CTA grande, lista do que ele tem
 * acesso, footer com suporte. Visual unificado com course-purchase-confirmation.
 */

export interface WelcomeCourseEmailProps {
  /** Nome do aluno (pra cumprimento personalizado). */
  studentName: string;
  /** Email do aluno (pra footer "vinculado ao seu email"). */
  studentEmail: string;
  /** Título do curso (ex: "NASA Route — Closer de Alto Ticket"). */
  courseTitle: string;
  /** Nome do plano contratado (ex: "Plano Premium"). */
  planName: string;
  /** Quem criou o curso (ex: "NASA Agents"). */
  creatorName: string;
  /** URL pro player de aulas (rota autenticada). */
  coursePlayerUrl: string;
  /** Total de aulas (mostra "X aulas disponíveis"). */
  totalLessons?: number;
  /** Total de módulos (mostra "X módulos"). */
  totalModules?: number;
  /** Email de suporte pra footer. */
  supportEmail?: string;
}

export const WelcomeCourseEmail = ({
  studentName,
  studentEmail,
  courseTitle,
  planName,
  creatorName,
  coursePlayerUrl,
  totalLessons,
  totalModules,
  supportEmail = "suporte@nasaagents.com",
}: WelcomeCourseEmailProps) => {
  const previewText = `Bem-vindo(a) ao curso "${courseTitle}" — acesso liberado!`;
  const firstName = studentName.split(" ")[0] || studentName;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-0 max-w-[560px] bg-white overflow-hidden">
            {/* ─── HERO ROXO ─────────────────────────────────────────── */}
            <Section className="bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] px-8 py-10 text-center">
              <Text className="text-white text-[12px] uppercase tracking-[2px] font-bold m-0 mb-3 opacity-80">
                🚀 acesso liberado
              </Text>
              <Heading className="text-white text-[28px] font-bold m-0 leading-tight">
                Bem-vindo(a) ao NASA Route, {firstName}!
              </Heading>
              <Text className="text-white text-[15px] mt-3 mb-0 opacity-95 leading-[24px]">
                Sua jornada de aprendizado começa agora. Tudo pronto pra você
                acessar o curso.
              </Text>
            </Section>

            {/* ─── BLOCO INFO DO CURSO ──────────────────────────────── */}
            <Section className="px-8 pt-8 pb-2">
              <Section className="bg-[#f5f3ff] rounded-xl p-5 border border-solid border-[#ddd6fe]">
                <Row>
                  <Column>
                    <Text className="text-[#5b21b6] text-[11px] uppercase tracking-wider mb-2 font-bold m-0">
                      Você adquiriu
                    </Text>
                    <Text className="text-[#0a0a0a] text-[18px] font-semibold m-0 leading-[26px]">
                      {courseTitle}
                    </Text>
                    <Text className="text-[#737373] text-[13px] m-0 mt-2">
                      <strong className="text-[#525252]">{planName}</strong>
                      {" · "}por {creatorName}
                    </Text>
                    {(totalLessons || totalModules) && (
                      <Text className="text-[#737373] text-[12px] m-0 mt-3">
                        {totalModules ? `${totalModules} módulos · ` : ""}
                        {totalLessons ? `${totalLessons} aulas` : ""} ·
                        acesso vitalício
                      </Text>
                    )}
                  </Column>
                </Row>
              </Section>
            </Section>

            {/* ─── CTA BOTÃO ────────────────────────────────────────── */}
            <Section className="px-8 pt-6 pb-2 text-center">
              <Button
                className="bg-[#7c3aed] rounded-lg text-white text-[15px] font-semibold no-underline text-center px-8 py-4 box-border"
                href={coursePlayerUrl}
              >
                Acessar o curso agora →
              </Button>
            </Section>

            <Text className="text-[#737373] text-[12px] leading-5 text-center px-8 m-0 mt-2">
              Ou copie e cole no navegador:
            </Text>
            <Text className="text-center my-2 px-8">
              <Link
                href={coursePlayerUrl}
                className="text-[#7c3aed] no-underline text-[12px] break-all"
              >
                {coursePlayerUrl}
              </Link>
            </Text>

            {/* ─── O QUE FAZER AGORA ────────────────────────────────── */}
            <Section className="px-8 pt-8 pb-4">
              <Heading className="text-[#0a0a0a] text-[16px] font-semibold m-0 mb-4">
                O que fazer agora
              </Heading>

              <Row className="mb-3">
                <Column className="w-[32px] align-top">
                  <Text className="text-[#7c3aed] text-[18px] font-bold m-0">
                    1.
                  </Text>
                </Column>
                <Column>
                  <Text className="text-[#0a0a0a] text-[14px] font-semibold m-0">
                    Comece pela primeira aula
                  </Text>
                  <Text className="text-[#737373] text-[13px] m-0 mt-1 leading-[20px]">
                    Clique no botão acima pra cair direto no player.
                  </Text>
                </Column>
              </Row>

              <Row className="mb-3">
                <Column className="w-[32px] align-top">
                  <Text className="text-[#7c3aed] text-[18px] font-bold m-0">
                    2.
                  </Text>
                </Column>
                <Column>
                  <Text className="text-[#0a0a0a] text-[14px] font-semibold m-0">
                    Faça no seu ritmo
                  </Text>
                  <Text className="text-[#737373] text-[13px] m-0 mt-1 leading-[20px]">
                    Seu progresso é salvo automaticamente. Acessa de onde
                    parou, em qualquer device.
                  </Text>
                </Column>
              </Row>

              <Row className="mb-2">
                <Column className="w-[32px] align-top">
                  <Text className="text-[#7c3aed] text-[18px] font-bold m-0">
                    3.
                  </Text>
                </Column>
                <Column>
                  <Text className="text-[#0a0a0a] text-[14px] font-semibold m-0">
                    Ganhe Stars Power (SP)
                  </Text>
                  <Text className="text-[#737373] text-[13px] m-0 mt-1 leading-[20px]">
                    Cada aula concluída te dá pontos que viram benefícios na
                    plataforma.
                  </Text>
                </Column>
              </Row>
            </Section>

            <Hr className="border border-solid border-[#e5e5e5] my-2 mx-8" />

            {/* ─── FOOTER ────────────────────────────────────────────── */}
            <Section className="px-8 py-4">
              <Text className="text-[#525252] text-[12px] leading-5 m-0 mb-2">
                Esse acesso está vinculado ao email{" "}
                <strong className="text-[#0a0a0a]">{studentEmail}</strong>.
              </Text>
              <Text className="text-[#737373] text-[12px] leading-5 m-0">
                Qualquer dúvida, é só responder este email ou escrever pro{" "}
                <Link
                  href={`mailto:${supportEmail}`}
                  className="text-[#7c3aed] no-underline font-medium"
                >
                  {supportEmail}
                </Link>
                .
              </Text>
            </Section>

            <Section className="bg-[#fafafa] px-8 py-4 text-center">
              <Text className="text-[#a3a3a3] text-[11px] leading-5 m-0">
                Bom estudo! 🚀
                <br />
                Time N.A.S.A.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactWelcomeCourseEmail(props: WelcomeCourseEmailProps) {
  return <WelcomeCourseEmail {...props} />;
}
