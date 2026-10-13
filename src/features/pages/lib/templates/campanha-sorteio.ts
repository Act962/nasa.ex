/**
 * Modelo "Campanha de sorteio" — página pública com a mecânica e o regulamento de uma promoção
 * do tipo "comprou, participou" atendida pelo WhatsApp (STAR FRIENDS, spec 0102). Os textos são
 * de exemplo: troque datas, prêmios, link do WhatsApp e o número do certificado de autorização.
 */
import type { ElementBase } from "../../types";

type TemplateElement = Omit<ElementBase, "id">;

export const CAMPANHA_SORTEIO_TOKENS = {
  primary: "#E11D2A",
  accent: "#FACC15",
  bg: "#FFFFFF",
  fg: "#111827",
  muted: "#6B7280",
};

const SECTION_WIDTH = 1200;
const WHATSAPP_URL = "https://wa.me/5500000000000?text=Quero%20participar%20da%20promo%C3%A7%C3%A3o";

const SECTION_COLORS = {
  bgColor: CAMPANHA_SORTEIO_TOKENS.bg,
  fgColor: CAMPANHA_SORTEIO_TOKENS.fg,
  primaryColor: CAMPANHA_SORTEIO_TOKENS.primary,
  mutedColor: CAMPANHA_SORTEIO_TOKENS.muted,
};

type SectionDraft = Omit<TemplateElement, "x" | "y" | "w">;

function stackSections(sections: SectionDraft[]): TemplateElement[] {
  let nextY = 0;
  return sections.map((section) => {
    const positioned = { ...section, x: 0, y: nextY, w: SECTION_WIDTH } as TemplateElement;
    nextY += section.h as number;
    return positioned;
  });
}

export function campanhaSorteioElements(): TemplateElement[] {
  return stackSections([
    {
      type: "section-hero",
      h: 480,
      badge: "🎉 Promoção de aniversário",
      titleLine1: "Comprou,",
      titleLine2: "participou!",
      subtitle: "A cada R$ 100,00 em compras você ganha 1 número da sorte. É só mandar a foto do cupom no nosso WhatsApp.",
      primaryCta: "Participar pelo WhatsApp",
      primaryCtaHref: WHATSAPP_URL,
      secondaryCta: "Ver o regulamento",
      secondaryCtaHref: "#regulamento",
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 440,
      heading: "Como participar",
      subheading: "Três passos, tudo pelo WhatsApp.",
      features: [
        { id: "1", icon: "🛒", title: "Compre na loja", description: "Guarde o cupom fiscal ou o comprovante da sua compra." },
        { id: "2", icon: "📸", title: "Envie a foto do cupom", description: "Mande pelo nosso WhatsApp oficial. No primeiro envio, informe seu nome e aceite as regras." },
        { id: "3", icon: "🎟️", title: "Receba seus números", description: "A cada R$ 100,00 você recebe 1 número da sorte na hora. O que sobrar soma no próximo cupom." },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 440,
      heading: "Quanto mais compra, mais chances",
      subheading: "Os valores dos seus cupons se somam.",
      features: [
        { id: "1", icon: "1️⃣", title: "R$ 100", description: "1 número da sorte." },
        { id: "2", icon: "2️⃣", title: "R$ 200", description: "2 números da sorte." },
        { id: "3", icon: "3️⃣", title: "R$ 300", description: "3 números da sorte, e assim por diante." },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-faq",
      h: 760,
      heading: "Regulamento",
      items: [
        { id: "1", question: "Quem pode participar?", answer: "Pessoas físicas maiores de 18 anos que comprarem na loja durante o período da promoção e enviarem o cupom pelo WhatsApp oficial." },
        { id: "2", question: "Qual é o período?", answer: "De DD/MM/AAAA a DD/MM/AAAA. Só valem compras feitas nesse período. O sorteio será em DD/MM/AAAA." },
        { id: "3", question: "Como os números são calculados?", answer: "A cada R$ 100,00 em compras, 1 número da sorte. Valores abaixo de R$ 100,00 ficam guardados e somam com o próximo cupom do mesmo participante." },
        { id: "4", question: "Posso enviar o mesmo cupom mais de uma vez?", answer: "Não. Cada cupom vale uma única vez, para um único participante. Cupom repetido, adulterado, ilegível ou de outro estabelecimento é recusado." },
        { id: "5", question: "Os cupons são conferidos?", answer: "Sim. Antes do sorteio todos os cupons passam por uma conferência. Números gerados por cupom repetido ou irregular são cancelados, mesmo que já tenham sido enviados ao participante." },
        { id: "6", question: "Como consulto meus números?", answer: "Pelo mesmo WhatsApp e pelo mesmo celular usado no cadastro. Por segurança, os dados só são mostrados no aparelho que se cadastrou." },
        { id: "7", question: "Quais são os prêmios?", answer: "Descreva aqui os prêmios, a quantidade e como será a entrega." },
        { id: "8", question: "Como meus dados são usados?", answer: "Nome, telefone e a foto do cupom são usados só para a promoção: gerar os números, conferir os cupons e avisar o ganhador. Não são vendidos nem repassados." },
        { id: "9", question: "A promoção é autorizada?", answer: "Certificado de Autorização SPA/MF nº 00.000000/0000." },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-cta",
      h: 400,
      heading: "Já comprou?",
      headingAccent: "Mande o cupom agora.",
      subtitle: "Leva menos de um minuto e os números chegam na conversa.",
      primaryCta: "Enviar meu cupom",
      primaryCtaHref: WHATSAPP_URL,
      secondaryCta: "Voltar ao início",
      secondaryCtaHref: "#",
      guarantees: ["Cada cupom vale uma vez", "Conferência antes do sorteio"],
      ...SECTION_COLORS,
    },
  ]);
}
