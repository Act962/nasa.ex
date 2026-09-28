// Marcações sobre as capturas da Meta (spec 0040, RF-3). As imagens em
// `public/guides/whatsapp-oficial/` são capturas reais fornecidas pela equipe;
// quando a Meta mudar a tela, troque a imagem e ajuste o destaque aqui.
// Posições em % da imagem.

export interface GuideHighlight {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GuideStep {
  id: string;
  imageSrc: string;
  caption: string;
  highlight: GuideHighlight;
}

export const GUIDE_STEPS = {
  metaLogin: {
    id: "meta-login",
    imageSrc: "/guides/whatsapp-oficial/01-meta-login.png",
    caption: "Entre com o Facebook de quem administra a empresa e clique em Continuar.",
    highlight: { left: 30, top: 72, width: 40, height: 10 },
  },
  metaBusiness: {
    id: "meta-business",
    imageSrc: "/guides/whatsapp-oficial/02-meta-portfolio.png",
    caption: "Escolha o portfólio da sua empresa (ou crie um) e a conta do WhatsApp.",
    highlight: { left: 10, top: 35, width: 80, height: 20 },
  },
  smsCode: {
    id: "sms-code",
    imageSrc: "/guides/whatsapp-oficial/03-meta-sms-code.png",
    caption: "Cole aqui o código de 6 dígitos que chegou por SMS.",
    highlight: { left: 20, top: 48, width: 60, height: 12 },
  },
  billingHub: {
    id: "billing-hub",
    imageSrc: "/guides/whatsapp-oficial/04-billing-hub.png",
    caption: "No Billing Hub, clique em \"Adicionar forma de pagamento\".",
    highlight: { left: 62, top: 18, width: 30, height: 9 },
  },
  addCard: {
    id: "add-card",
    imageSrc: "/guides/whatsapp-oficial/05-add-card.png",
    caption: "Preencha os dados do cartão da empresa e salve.",
    highlight: { left: 15, top: 30, width: 70, height: 45 },
  },
} satisfies Record<string, GuideStep>;
