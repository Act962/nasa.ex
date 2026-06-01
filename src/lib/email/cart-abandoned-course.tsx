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
 * Email de recuperação de carrinho NASA Route — disparado pelo cron
 * `nasa-route-cart-recovery` quando o lead criou um PendingCoursePurchase
 * mas não concluiu o pagamento. Parametrizado por estágio:
 *
 *   stage="d1"  → 1 dia depois — leve, "viu algo?"
 *   stage="d3"  → 3 dias — destaca benefícios, prova social
 *   stage="d7"  → 7 dias — escassez, "última chamada"
 *   stage="d15" → 15 dias — desconto/oferta (operador pode editar copy)
 *
 * Após D+30 sem ação, cron marca PendingCoursePurchase como ABANDONED e
 * para de enviar. Nenhuma cobrança via Stripe acontece se o lead nunca
 * voltou (Stripe expira sessão em ~24h sozinho).
 */

export type CartAbandonedStage = "d1" | "d3" | "d7" | "d15";

export interface CartAbandonedCourseEmailProps {
  /** Nome (ou primeira parte do email se sem nome). */
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  planName: string;
  creatorName: string;
  /** Preço em BRL pra mostrar no destaque. */
  amountBrl: number;
  /** URL pra retomar o checkout. */
  checkoutUrl: string;
  /** Em qual estágio da cadência estamos. */
  stage: CartAbandonedStage;
  supportEmail?: string;
}

const STAGE_CONFIG: Record<
  CartAbandonedStage,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    cta: string;
    previewPrefix: string;
  }
> = {
  d1: {
    eyebrow: "Faltou só um passo",
    heading: "Vimos que você quase fechou",
    intro:
      "Você começou o checkout e não terminou — tudo bem, deixei sua vaga reservada por aqui.",
    cta: "Concluir minha matrícula",
    previewPrefix: "Faltou pouco —",
  },
  d3: {
    eyebrow: "3 dias depois",
    heading: "Ainda dá tempo de garantir",
    intro:
      "Sua vaga continua aberta. Vários alunos voltam alguns dias depois — geralmente porque vale a pena dormir sobre isso.",
    cta: "Quero ver de novo",
    previewPrefix: "Sua vaga continua aberta —",
  },
  d7: {
    eyebrow: "Última chamada",
    heading: "Tô fechando inscrições por aqui",
    intro:
      "Já são 7 dias do seu checkout. Vou liberar sua vaga em breve pra não bloquear outras pessoas. Se ainda fizer sentido, conclua agora.",
    cta: "Garantir minha vaga agora",
    previewPrefix: "Última chamada —",
  },
  d15: {
    eyebrow: "Antes de encerrar",
    heading: "Última oportunidade",
    intro:
      "Tô prestes a marcar sua matrícula como cancelada. Se você ainda quer entrar, esse é o melhor momento — depois disso o link expira.",
    cta: "Continuar minha matrícula",
    previewPrefix: "Última oportunidade —",
  },
};

export const CartAbandonedCourseEmail = ({
  studentName,
  studentEmail,
  courseTitle,
  planName,
  creatorName,
  amountBrl,
  checkoutUrl,
  stage,
  supportEmail = "suporte@nasaagents.com",
}: CartAbandonedCourseEmailProps) => {
  const cfg = STAGE_CONFIG[stage];
  const firstName = studentName.split(" ")[0] || studentName;
  const amountStr = amountBrl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const previewText = `${cfg.previewPrefix} "${courseTitle}"`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-0 max-w-[560px] bg-white overflow-hidden">
            {/* ─── HEADER ROXO MAIS SUTIL (não-comemorativo) ───────── */}
            <Section className="bg-[#7c3aed] px-8 py-6">
              <Text className="text-white text-[11px] uppercase tracking-[2px] font-bold m-0 opacity-80">
                {cfg.eyebrow}
              </Text>
              <Heading className="text-white text-[24px] font-bold m-0 mt-2 leading-tight">
                {firstName}, {cfg.heading.toLowerCase()}
              </Heading>
            </Section>

            <Section className="px-8 pt-6 pb-2">
              <Text className="text-[#0a0a0a] text-[15px] leading-[24px] m-0">
                {cfg.intro}
              </Text>
            </Section>

            {/* ─── CARD CURSO ──────────────────────────────────────── */}
            <Section className="px-8 pt-4">
              <Section className="bg-[#f5f3ff] rounded-xl p-5 border border-solid border-[#ddd6fe]">
                <Row>
                  <Column>
                    <Text className="text-[#5b21b6] text-[11px] uppercase tracking-wider mb-2 font-bold m-0">
                      Sua matrícula pendente
                    </Text>
                    <Text className="text-[#0a0a0a] text-[17px] font-semibold m-0 leading-[24px]">
                      {courseTitle}
                    </Text>
                    <Text className="text-[#737373] text-[13px] m-0 mt-2">
                      <strong className="text-[#525252]">{planName}</strong>
                      {" · "}por {creatorName}
                    </Text>
                    <Hr className="border border-solid border-[#ddd6fe] my-3 mx-0" />
                    <Text className="text-[#0a0a0a] text-[20px] font-bold m-0">
                      {amountStr}
                    </Text>
                  </Column>
                </Row>
              </Section>
            </Section>

            {/* ─── CTA ─────────────────────────────────────────────── */}
            <Section className="px-8 pt-6 pb-2 text-center">
              <Button
                className="bg-[#7c3aed] rounded-lg text-white text-[15px] font-semibold no-underline text-center px-8 py-4 box-border"
                href={checkoutUrl}
              >
                {cfg.cta} →
              </Button>
            </Section>

            <Text className="text-[#737373] text-[12px] leading-5 text-center px-8 m-0 mt-2">
              Ou copie e cole:
            </Text>
            <Text className="text-center my-2 px-8">
              <Link
                href={checkoutUrl}
                className="text-[#7c3aed] no-underline text-[12px] break-all"
              >
                {checkoutUrl}
              </Link>
            </Text>

            {stage === "d3" && (
              <Section className="px-8 pt-6">
                <Section className="bg-[#fafafa] rounded-lg p-4 border-l-[3px] border-solid border-[#7c3aed]">
                  <Text className="text-[#525252] text-[13px] italic leading-[22px] m-0">
                    &quot;Demorei uma semana pra decidir, mas valeu cada
                    centavo. O conteúdo é direto ao ponto e mudou meu jeito
                    de fechar venda.&quot;
                  </Text>
                  <Text className="text-[#737373] text-[12px] m-0 mt-2 font-medium">
                    — Aluno NASA Route
                  </Text>
                </Section>
              </Section>
            )}

            {stage === "d7" && (
              <Section className="px-8 pt-6">
                <Section className="bg-[#fef2f2] rounded-lg p-4 border border-solid border-[#fecaca]">
                  <Text className="text-[#991b1b] text-[13px] font-semibold m-0">
                    ⚠️ Sua vaga será liberada em breve
                  </Text>
                  <Text className="text-[#7f1d1d] text-[12px] m-0 mt-1 leading-[20px]">
                    Estamos com lista de espera. Se você não concluir nos
                    próximos dias, vamos liberar sua vaga pra outra pessoa.
                  </Text>
                </Section>
              </Section>
            )}

            <Hr className="border border-solid border-[#e5e5e5] my-6 mx-8" />

            <Section className="px-8 py-2">
              <Text className="text-[#737373] text-[12px] leading-5 m-0">
                Esse link foi enviado pra{" "}
                <strong className="text-[#0a0a0a]">{studentEmail}</strong>.
                Não foi você? Pode ignorar — nenhuma cobrança será feita.
              </Text>
              <Text className="text-[#737373] text-[12px] leading-5 m-0 mt-3">
                Dúvidas? Responde esse email ou escreve pro{" "}
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
                © N.A.S.A. Todos os direitos reservados.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactCartAbandonedCourseEmail(
  props: CartAbandonedCourseEmailProps,
) {
  return <CartAbandonedCourseEmail {...props} />;
}
