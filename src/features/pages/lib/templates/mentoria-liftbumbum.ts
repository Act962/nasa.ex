/**
 * Modelo "Mentoria LiftBumbum®" — landing da mentoria presencial da Dra. Thaine Malinowski,
 * com os textos e a ordem das seções do site drathainemalinowski.com.
 */
import type { ElementBase } from "../../types";

type TemplateElement = Omit<ElementBase, "id">;

export const MENTORIA_LIFTBUMBUM_TOKENS = {
  primary: "#C8A96E",
  accent: "#E7D3A7",
  bg: "#070707",
  fg: "#FFFFFF",
  muted: "#A3A3A3",
};

const SITE_ASSETS_ORIGIN = "https://www.drathainemalinowski.com";
const WHATSAPP_URL = "https://wa.me/559286062977";
const SECTION_WIDTH = 1200;

function whatsappUrlWithMessage(message: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}

const SECTION_COLORS = {
  bgColor: MENTORIA_LIFTBUMBUM_TOKENS.bg,
  fgColor: MENTORIA_LIFTBUMBUM_TOKENS.fg,
  primaryColor: MENTORIA_LIFTBUMBUM_TOKENS.primary,
  mutedColor: MENTORIA_LIFTBUMBUM_TOKENS.muted,
};

/** Empilha as seções na ordem dada, calculando o `y` de cada uma pela altura das anteriores. */
function stackSections(sections: Array<{ type: ElementBase["type"]; h: number } & Record<string, unknown>>): TemplateElement[] {
  let nextSectionY = 0;
  return sections.map((section) => {
    const stackedSection = { ...section, x: 0, y: nextSectionY, w: SECTION_WIDTH } as TemplateElement;
    nextSectionY += section.h;
    return stackedSection;
  });
}

export function mentoriaLiftbumbumElements(): TemplateElement[] {
  const sections = stackSections([
    {
      type: "section-navbar",
      h: 72,
      logoText: "LIFTBUMBUM®",
      logoSrc: `${SITE_ASSETS_ORIGIN}/logo-navbar.png`,
      logoHref: "#mentoria",
      links: [
        { id: "l1", label: "O Método", href: "#sobre-metodo" },
        { id: "l2", label: "Resultados", href: "#resultados" },
        { id: "l3", label: "Planos", href: "#planos" },
        { id: "l4", label: "Sobre", href: "#sobre" },
      ],
      primaryCta: "QUERO PARTICIPAR",
      primaryCtaHref: WHATSAPP_URL,
      secondaryCta: "",
      secondaryCtaHref: "#planos",
      ...SECTION_COLORS,
    },
    {
      type: "section-media-text",
      h: 820,
      anchorId: "mentoria",
      isHero: true,
      cascadeReveal: true,
      eyebrow: "Método registrado ® | Vagas limitadas para profissionais de elite",
      heading: "Escolha sua experiência. O método que vai fazer você *subir de nível*.",
      body: "A mentoria que une ciência, estética avançada e resultados reais.",
      checklist: [
        "Domínio Técnico Avançado: protocolos exclusivos com Bioestimuladores e Ácido Hialurônico para resultados imediatos e duradouros.",
        "Hands-On com Modelos Reais: prática supervisionada individualmente sob o olhar da Dra. Thaine, com segurança total.",
        "Aceleração de Negócio & Marketing: o 'Dia 3' focado em Business — Instagram, scripts de vendas e captação de pacientes de alto padrão.",
        "Networking e Comunidade VIP: faça parte de um ecossistema de profissionais referências no Brasil.",
        "Mentoria e Suporte por 6 Meses: canal direto para análise de casos clínicos e suporte técnico por 180 dias.",
        "Bônus Exclusivo: Kit de Marketing (fotos e vídeos profissionais) + Certificado de Especialista Licenciada.",
        "Assistente Videomaker: vai estar ao vivo com você, captando todos os detalhes e tirando suas dúvidas.",
      ],
      stats: ["500+ | Alunas formadas", "98% | Satisfação", "3 Dias | Imersão completa"],
      imageUrl: `${SITE_ASSETS_ORIGIN}/foto_thaine.png`,
      imageAlt: "Dra. Thaine Malinowski — Especialista em Harmonização Corporal",
      imageSide: "right",
      primaryButtonLabel: "QUERO PARTICIPAR",
      primaryButtonHref: WHATSAPP_URL,
      secondaryButtonLabel: "VER PLANOS",
      secondaryButtonHref: "#planos",
      ...SECTION_COLORS,
    },
    {
      type: "marquee",
      h: 72,
      items: [
        { id: "m1", label: "HARMONIZAÇÃO CORPORAL" },
        { id: "m2", label: "✦ MÉTODO LIFTBUMBUM®" },
        { id: "m3", label: "✦ DRA. THAINE MALINOWSKI" },
        { id: "m4", label: "✦ RESULTADOS REAIS" },
        { id: "m5", label: "✦ MENTORIA EXCLUSIVA" },
        { id: "m6", label: "✦ TRANSFORMAÇÃO COMPLETA ✦" },
      ],
      speed: 30,
      gap: 48,
      bgColor: MENTORIA_LIFTBUMBUM_TOKENS.bg,
      fgColor: MENTORIA_LIFTBUMBUM_TOKENS.primary,
    },
    {
      type: "section-before-after",
      h: 760,
      anchorId: "problema",
      cascadeReveal: true,
      eyebrow: "Você se reconhece nisso?",
      heading:
        "Até quando você será \"apenas mais uma\" na estética enquanto seus concorrentes *crescem e dominam* sua região?",
      subheading:
        "Cursos rasos, técnicas que não entregam o que prometem e a eterna guerra de preços por pacientes que não valorizam seu trabalho. Se você está cansada de agendas vazias e insegurança na aplicação, o problema não é você — é a sua metodologia.",
      beforeEyebrow: "Você se sente assim?",
      beforeTitle: "Onde você está agora",
      beforeItems: [
        "Medo de intercorrências por falta de base anatômica.",
        "Dificuldade em cobrar caro e ser valorizada pelos pacientes.",
        "Resultados que desaparecem em poucos meses.",
        "Depende exclusivamente de indicação para conseguir novos clientes.",
        "Cursos rasos, técnicas que não entregam o que prometem e a eterna guerra de preços.",
      ],
      afterEyebrow: "A mentoria é para você se…",
      afterTitle: "Onde você vai estar",
      afterItems: [
        "Dominando o Método LiftBumbum® com segurança técnica total.",
        "Cobrando de R$ 3.000 a R$ 12.000 por protocolo com confiança.",
        "Resultados imediatos e duradouros que fidelizam pacientes.",
        "Atraindo pacientes de alto padrão pelo posicionamento, não pelo preço.",
        "Suporte contínuo e uma rede exclusiva de profissionais referências.",
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 620,
      anchorId: "para-quem",
      cascadeReveal: true,
      heading: "Esta mentoria é para *você* se…",
      subheading: "Para quem é",
      features: [
        {
          id: "pq1",
          icon: "01",
          title: "Você é profissional de estética ou saúde",
          description:
            "Fisioterapeuta, biomédica, enfermeira, esteticista ou médica que quer se especializar em harmonização corporal.",
        },
        {
          id: "pq2",
          icon: "02",
          title: "Quer resultados que realmente impressionam",
          description: "Cansada de técnicas superficiais que não entregam o que prometem.",
        },
        {
          id: "pq3",
          icon: "03",
          title: "Deseja escalar seu negócio na estética",
          description: "Quer cobrar mais, atrair pacientes de alto valor e se tornar referência na sua cidade.",
        },
        {
          id: "pq4",
          icon: "04",
          title: "Busca uma mentora que já chegou lá",
          description: "Você quer aprender com quem faz, não só com quem fala.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 720,
      anchorId: "sobre-metodo",
      cascadeReveal: true,
      heading: "Muito além de uma aplicação: uma *Engenharia de Resultados*",
      subheading:
        "O Método LiftBumbum® é fundamentado em três pilares que garantem a segurança da profissional e o encantamento da paciente desde a primeira sessão.",
      features: [
        {
          id: "mt1",
          icon: "I",
          title: "Mapeamento Anatômico Geométrico",
          description:
            "Não existe protocolo 'copia e cola'. Você aprenderá a realizar o mapeamento dos vetores de força e pontos de sustentação específicos de cada biotipo. Identificamos as zonas de depressão trocantérica e ptose para um planejamento individualizado. ◆ Diagnóstico de precisão para evitar desperdício de produto.",
        },
        {
          id: "mt2",
          icon: "II",
          title: "A Trindade de Ativos (Sinergia de Produtos)",
          description:
            "O segredo do volume e da textura está na combinação estratégica. Ensinamos como utilizar a sinergia entre Bioestimuladores de Colágeno (sustentação e firmeza) e Ácido Hialurônico de alta reticulação (projeção e contorno), somados a protocolos para tratamento de celulite e qualidade de pele. ◆ Resultados imediatos com durabilidade prolongada.",
        },
        {
          id: "mt3",
          icon: "III",
          title: "Vetorização e Planos de Aplicação",
          description:
            "A técnica correta no plano certo. Dominamos a aplicação em diferentes camadas teciduais, utilizando cânulas de precisão para minimizar o trauma e maximizar a segurança. É a arte de esculpir o glúteo respeitando a fisiologia do corpo feminino. ◆ Segurança total contra intercorrências graves.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 480,
      anchorId: "diferenciais",
      cascadeReveal: true,
      heading: "O que nos torna *únicos*",
      subheading: "",
      features: [
        {
          id: "un1",
          icon: "🔬",
          title: "Ciência em Primeiro Lugar",
          description: "Baseado em estudos anatômicos recentes e parcerias com grandes marcas como a Rennova.",
        },
        {
          id: "un2",
          icon: "💎",
          title: "Protocolo High-Ticket",
          description:
            "Uma metodologia desenhada para que você possa cobrar de R$ 3.000 a R$ 12.000 por protocolo, elevando o nível da sua clínica.",
        },
        {
          id: "un3",
          icon: "®",
          title: "Marca Registrada ®",
          description: "Você aprende um método oficial, com selo de qualidade reconhecido nacionalmente.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 820,
      anchorId: "cronograma",
      cascadeReveal: true,
      heading: "3 dias que vão mudar o patamar do seu *faturamento, conhecimento e posicionamento*.",
      subheading: "Uma jornada intensiva que vai do diagnóstico de luxo ao fechamento de contratos de alto ticket.",
      features: [
        {
          id: "dia1",
          icon: "01",
          title: "Dia 1 — A Ciência e o Planejamento",
          description:
            "Fundamentos de Luxo. \"Não é sobre aplicar, é sobre planejar para não errar.\" • Anatomia 360º: estudo profundo dos compartimentos de gordura, músculos e vasos. • Engenharia de Produtos: sinergia entre Bioestimuladores, PDRN e Ácido Hialurônico. • Avaliação Geométrica: como mapear o glúteo e prever o resultado final. • Manejo de Intercorrências: protocolos de segurança para você dormir tranquila. ✓ Você terá o olhar clínico de uma especialista licenciada.",
        },
        {
          id: "dia2",
          icon: "02",
          title: "Dia 2 — A Prática Hands-On",
          description:
            "Mão na Massa Supervisionada. \"Transforme a teoria em resultado real com segurança total.\" • Demonstração VIP: acompanhe a Dra. Thaine realizando o Método LiftBumbum® passo a passo. • Prática Supervisionada: você aplica a técnica em modelos reais (pré-selecionadas) com correção imediata. • Domínio de Cânulas: refinamento de vetores de tração e planos de aplicação. • Protocolo Pós-Procedimento: orientações para garantir a durabilidade do resultado. ✓ Você terá a segurança prática que nenhum curso online pode entregar.",
        },
        {
          id: "dia3",
          icon: "03",
          title: "Dia 3 — O Business da Estética",
          description:
            "Marketing, Vendas e Escala. \"A melhor técnica do mundo não se vende sozinha.\" • Posicionamento de Autoridade: como ser vista como a 'Dra. Referência' e não como uma 'aplicadora'. • Instagram Magnético: o método para atrair pacientes de alto padrão sem precisar fazer dancinhas. • Script de Fechamento de R$ 10k: como transformar uma avaliação simples em protocolo completo. • Networking e Mentalidade: como gerir sua clínica para ter liberdade geográfica e financeira. ✓ Você sairá com o mapa exato para recuperar o investimento da mentoria em poucas semanas.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-cta",
      h: 380,
      anchorId: "diferencial-exclusivo",
      cascadeReveal: true,
      heading: "Diferencial exclusivo:",
      headingAccent: "você sai sabendo como vender.",
      subtitle:
        "Enquanto outros cursos terminam na técnica, nós terminamos na sua primeira venda de alto ticket. Você não sai apenas sabendo \"como fazer\", você sai sabendo \"como vender\".",
      buttons: [
        {
          id: "btn-cronograma",
          label: "QUERO VER O CRONOGRAMA COMPLETO NO WHATSAPP",
          href: WHATSAPP_URL,
          variant: "primary",
        },
      ],
      guarantees: [],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 720,
      anchorId: "ecossistema",
      cascadeReveal: true,
      heading: "Você nunca estará *sozinha* na sua jornada.",
      subheading:
        "A Mentoria LiftBumbum® não termina quando o terceiro dia acaba. Você entra para um ecossistema desenhado para garantir sua evolução contínua e resultado.",
      features: [
        {
          id: "eco1",
          icon: "🤝",
          title: "Comunidade Elite de Networking",
          description:
            "Conexões que geram lucro. Acesso vitalício ao nosso grupo exclusivo de alunas licenciadas. Um espaço para trocar experiências, compartilhar fornecedores com preços diferenciados e discutir casos complexos com profissionais que buscam o mesmo nível de excelência que você. O networking que você constrói aqui é o seu maior ativo. ◆ Onde as melhores se encontram.",
        },
        {
          id: "eco2",
          icon: "🛡️",
          title: "Mentoria e Suporte Pós-Curso (6 meses)",
          description:
            "Segurança total para suas primeiras aplicações. Surgiram dúvidas no primeiro paciente pós-mentoria? Nós estamos aqui. Você terá um canal direto de suporte por 180 dias para análise de casos clínicos, auxílio em intercorrências e revisão de protocolos. É a Dra. Thaine e sua equipe técnica pegando na sua mão até você atingir a maestria. ◆ Segurança clínica do seu lado 24/7.",
        },
        {
          id: "eco3",
          icon: "📚",
          title: "O Cofre de Aulas Extras (Marketing & Vendas)",
          description:
            "Seu posicionamento como autoridade nacional. Além dos 3 dias presenciais, você recebe acesso à nossa plataforma online com aulas complementares de marketing digital, gestão de tráfego para clínicas de estética e técnicas avançadas de fechamento. Aprenda a se posicionar no Instagram para que o preço nunca mais seja um obstáculo para suas pacientes. ◆ O manual do negócio lucrativo.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-cta",
      h: 420,
      anchorId: "suporte",
      cascadeReveal: true,
      heading: "180 dias de suporte técnico",
      headingAccent: "garantido.",
      subtitle:
        "\"O diferencial da Thaine é que ela não some. Quando tive minha primeira dúvida no consultório, a equipe me respondeu em minutos. Isso não tem preço.\" — Dra. Juliana, aluna Master",
      buttons: [
        {
          id: "btn-ecossistema",
          label: "QUERO FAZER PARTE DESSE ECOSSISTEMA",
          href: WHATSAPP_URL,
          variant: "primary",
        },
      ],
      guarantees: ["Restam poucas vagas para a próxima turma com suporte individualizado."],
      ...SECTION_COLORS,
    },
    {
      type: "section-media-text",
      h: 820,
      anchorId: "sobre",
      cascadeReveal: true,
      eyebrow: "A sua mentora",
      heading: "Muito além de uma técnica, uma *missão de vida*",
      body: [
        "A Dra. Thaine Malinowski não aceitou o 'comum'. Após anos de prática clínica intensa e milhares de procedimentos realizados, ela percebeu que o mercado de estética entregava resultados rasos e inseguros. Foi essa inconformidade que a levou a desenvolver uma metodologia que une o rigor científico à estética de alto padrão.",
        "Criadora do Método LiftBumbum®, marca registrada que se tornou sinônimo de glúteos perfeitos no Brasil, Thaine já transformou a carreira de mais de 500 profissionais. Sua clínica em Manaus/AM é hoje um centro de referência, atraindo pacientes e alunas de todos os estados brasileiros e do exterior.",
        "Hoje, sua missão é clara: empoderar outras profissionais de saúde e estética para que elas também alcancem a independência financeira e o reconhecimento profissional, através de técnicas seguras e um posicionamento de mercado inabalável.",
        "\"Minha missão é empoderar profissionais da estética com conhecimento sólido e técnicas que realmente transformam vidas.\"",
      ].join("\n"),
      checklist: ["Harmonização Corporal", "Protocolo LiftBumbum®", "Estética Avançada", "Mentora Clínica"],
      stats: [
        "500+ | Alunas formadas e faturando",
        "15k+ | Procedimentos realizados",
        "100% | Compromisso com sua evolução",
        "Rennova | Parceria exclusiva",
      ],
      imageUrl: `${SITE_ASSETS_ORIGIN}/images/elegant.jpg`,
      imageAlt: "Dra. Thaine Malinowski",
      imageSide: "left",
      primaryButtonLabel: "QUERO GARANTIR AGORA A MINHA VAGA",
      primaryButtonHref: WHATSAPP_URL,
      secondaryButtonLabel: "",
      secondaryButtonHref: "#planos",
      ...SECTION_COLORS,
    },
    {
      type: "section-testimonials",
      h: 480,
      anchorId: "resultados",
      cascadeReveal: true,
      heading: "O que dizem as *alunas*",
      testimonials: [
        {
          id: "t1",
          quote:
            "A mentoria da Dra. Thaine foi um divisor de águas na minha carreira. Em dois meses já recuperei o investimento e hoje tenho uma agenda cheia de pacientes encantadas.",
          author: "Ana Rodrigues",
          role: "Fisioterapeuta Estética • São Paulo",
          avatar: "",
        },
        {
          id: "t2",
          quote:
            "Nunca imaginei que 3 dias pudessem mudar tanto minha forma de trabalhar. O método é poderoso, a Dra. Thaine é incrível e o suporte pós-mentoria é excepcional.",
          author: "Camila Santos",
          role: "Biomédica Estética • Brasília",
          avatar: "",
        },
        {
          id: "t3",
          quote:
            "Profissionalismo e resultado acima de qualquer expectativa. Aprendi mais em 3 dias do que em 2 anos de cursos avulsos. Vale cada centavo do investimento!",
          author: "Mariana Lima",
          role: "Enfermeira Estética • Fortaleza",
          avatar: "",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-pricing",
      h: 900,
      anchorId: "planos",
      cascadeReveal: true,
      heading: "Invista no próximo nível da sua *carreira*",
      subheading:
        "Três formatos exclusivos para diferentes momentos da sua jornada profissional. Escolha o que melhor se adapta ao seu objetivo.",
      plans: [
        {
          id: "silver",
          name: "💎 Experience Silver",
          price: "12x R$ 458,33",
          period: "",
          slogan: "Para quem deseja entrar no método com base sólida e prática real. R$ 5.500 à vista no PIX.",
          features: [
            "03 dias de mentoria VIP presencial",
            "Suporte online por 6 meses",
            "Cupons de desconto e material incluso",
            "Material completo + certificado",
          ],
          ctaLabel: "QUERO O SILVER",
          ctaHref: whatsappUrlWithMessage("Olá, tenho interesse no Plano Silver."),
        },
        {
          id: "vip",
          name: "👑 Experience VIP",
          price: "12x R$ 740,66",
          period: "",
          slogan:
            "Para quem quer ir além da técnica e viver proximidade, estratégia e crescimento. R$ 8.888 à vista no PIX.",
          features: [
            "Tudo do Silver",
            "03 dias de almoço com a Dra. Thaine",
            "Atendimento na 2ª maca",
            "Suporte online por 6 meses",
            "Treinamento de vendas e posicionamento",
            "Cupons de desconto e material incluso",
            "Certificado",
            "Assistente Videomaker ao vivo com você",
            "🎁 Bônus: 05 fotos profissionais editadas",
            "🎁 Bônus: 02 vídeos editados dos seus atendimentos",
          ],
          ctaLabel: "QUERO O VIP",
          ctaHref: whatsappUrlWithMessage("Olá, tenho interesse no Plano VIP."),
          highlighted: true,
          badge: "MAIS ESCOLHIDO",
        },
        {
          id: "master",
          name: "💎 Experience Master",
          price: "12x R$ 832,50",
          period: "",
          slogan: "Para quem quer viver o nível mais alto da experiência. R$ 9.990 à vista no PIX.",
          features: [
            "Tudo do VIP",
            "03 dias de almoço com a Dra. Thaine",
            "Atendimento na 1ª maca (protagonismo total)",
            "Suporte online por 6 meses",
            "Treinamento de vendas e posicionamento",
            "50% de desconto na mentoria individual",
            "Cupons de desconto e material incluso",
            "Assistente Videomaker ao vivo com você",
            "🎁 Bônus: 05 fotos profissionais editadas",
            "🎁 Bônus: 02 vídeos editados dos seus atendimentos",
          ],
          ctaLabel: "QUERO O MASTER",
          ctaHref: whatsappUrlWithMessage("Olá, tenho interesse no Plano Master."),
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-comparison",
      h: 760,
      anchorId: "comparativo",
      cascadeReveal: true,
      eyebrow: "",
      heading: "A escolha *óbvia* está aqui",
      subheading: "",
      featureColumnLabel: "O que está incluso",
      columns: ["Silver", "Master", "VIP"],
      highlightedColumn: 2,
      rows: [
        { id: "r1", label: "3 dias de imersão presencial", values: ["yes", "yes", "yes"] },
        { id: "r2", label: "Apostila técnica e Certificado", values: ["yes", "yes", "yes"] },
        { id: "r3", label: "Acesso ao grupo de networking", values: ["yes", "yes", "yes"] },
        { id: "r4", label: "Kit de Marketing (fotos + vídeos)", values: ["no", "yes", "yes"] },
        { id: "r5", label: "Atendimento na 1ª Maca", values: ["no", "yes", "yes"] },
        { id: "r6", label: "Aulas extras (Marketing & Vendas)", values: ["no", "yes", "yes"] },
        { id: "r7", label: "Suporte prioritário 6 meses", values: ["no", "yes", "yes"] },
        { id: "r8", label: "Almoço de negócios com Dra. Thaine", values: ["no", "no", "yes"] },
        { id: "r9", label: "Mentoria individual pós-curso (1h)", values: ["no", "no", "yes"] },
        { id: "r10", label: "50% off em mentorias futuras", values: ["no", "no", "yes"] },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 440,
      anchorId: "garantias",
      cascadeReveal: true,
      heading: "Sua segurança em *primeiro lugar*",
      subheading: "",
      features: [
        {
          id: "g1",
          icon: "🛡️",
          title: "Garantia de Satisfação",
          description: "Devolvemos seu investimento se a entrega não condizer com o prometido.",
        },
        {
          id: "g2",
          icon: "🔒",
          title: "Ambiente 100% Seguro",
          description: "Pagamento processado com segurança. Seus dados estão protegidos em todo o processo.",
        },
        {
          id: "g3",
          icon: "💳",
          title: "Até 2 Cartões",
          description:
            "Aceitamos até dois cartões de crédito diferentes para facilitar o seu investimento na mentoria.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-features",
      h: 760,
      anchorId: "bonus",
      cascadeReveal: true,
      heading: "O seu sucesso *não pode esperar*.",
      subheading:
        "Além de toda a imersão presencial, você receberá um pacote de ferramentas prontas para acelerar o retorno do seu investimento.",
      features: [
        {
          id: "b1",
          icon: "🎁",
          title: "Bônus 01 — Kit de Marketing \"Ready-to-Post\"",
          description:
            "05 fotos em alta resolução e 02 vídeos (Reels) de você em ação durante a mentoria. De R$ 1.200,00 por GRÁTIS. Incluído nos planos Master/VIP.",
        },
        {
          id: "b2",
          icon: "🎁",
          title: "Bônus 02 — Script de Vendas \"Fechamento de Luxo\"",
          description:
            "O passo a passo exato de como abordar e converter o lead que chega perguntando o preço. De R$ 497,00 por GRÁTIS. Incluído em todos os planos.",
        },
        {
          id: "b3",
          icon: "🎁",
          title: "Bônus 03 — Pack de Artes e Identidade Visual",
          description:
            "Modelos de posts e stories editáveis no Canva com a estética do LiftBumbum®. De R$ 350,00 por GRÁTIS. Incluído em todos os planos.",
        },
        {
          id: "b4",
          icon: "🎁",
          title: "Bônus 04 — Guia de Fornecedores e Descontos Exclusivos",
          description:
            "Lista VIP de fornecedores parceiros com condições e descontos exclusivos na compra de injetáveis. Valor inestimável, GRÁTIS. Incluído em todos os planos.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-cta",
      h: 400,
      anchorId: "bonus-cta",
      cascadeReveal: true,
      heading: "Você leva mais de R$ 2.000,00 em bônus",
      headingAccent: "totalmente gratuitos.",
      subtitle: "Os bônus de marketing são exclusivos para as primeiras inscritas da turma.",
      buttons: [
        {
          id: "btn-bonus",
          label: "QUERO MINHA MENTORIA COM TODOS OS BÔNUS",
          href: WHATSAPP_URL,
          variant: "primary",
        },
      ],
      guarantees: ["Vagas limitadas — garantia de entrega individualizada por turma."],
      ...SECTION_COLORS,
    },
    {
      type: "section-faq",
      h: 760,
      anchorId: "faq",
      cascadeReveal: true,
      heading: "Ainda tem alguma *dúvida*?",
      items: [
        {
          id: "f1",
          question: "Para quem é esta mentoria?",
          answer:
            "A Mentoria LiftBumbum® é exclusiva para profissionais da área da saúde e estética (médicos, biomédicos, enfermeiros estetas, fisioterapeutas, farmacêuticos estetas e esteticistas graduados) que desejam dominar técnicas avançadas de harmonização de glúteos.",
        },
        {
          id: "f2",
          question: "Preciso ter experiência prévia com injetáveis?",
          answer:
            "Não é obrigatório ter experiência avançada, pois cobrimos desde a base anatômica até a prática hands-on. No entanto, é necessário ter a formação que permita legalmente a atuação na área.",
        },
        {
          id: "f3",
          question: "Onde e quando acontece a próxima turma?",
          answer:
            "Nossas imersões presenciais acontecem em Manaus/AM, em uma estrutura clínica de alto padrão. Para consultar as datas da próxima turma disponível, clique no botão de WhatsApp e fale com nossa consultora de vagas.",
        },
        {
          id: "f4",
          question: "Como funciona o suporte pós-mentoria?",
          answer:
            "Diferente de cursos comuns, você terá 180 dias (6 meses) de suporte técnico para enviar casos clínicos, fotos e dúvidas diretamente para nossa equipe.",
        },
        {
          id: "f5",
          question: "O material de aplicação está incluso na prática?",
          answer:
            "Sim! Todo o material (bioestimuladores, preenchedores, cânulas e descartáveis) para a prática nas modelos está incluso. Você só precisa trazer seu jaleco e sua vontade de aprender.",
        },
        {
          id: "f6",
          question: "Posso parcelar o valor da inscrição?",
          answer:
            "Sim. Facilitamos o seu investimento com entrada no Pix e o restante em até 12x no cartão de crédito, sendo possível utilizar até dois cartões diferentes.",
        },
        {
          id: "f7",
          question: "Como funciona o Assistente Videomaker da Mentoria?",
          answer:
            "Ele será um Assistente particular seu, caso você não possa ir presencialmente na mentoria, o assistente estará filmando tudo através do meet para você, ao vivo. Com isso, você poderá tirar dúvidas a qualquer momento, e ter os mínimos detalhes na tela do seu celular.",
        },
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-cta",
      h: 380,
      anchorId: "vaga",
      cascadeReveal: true,
      heading: "Vagas limitadas por turma",
      headingAccent: "para garantir o suporte individualizado.",
      subtitle: "Clique e fale com nossa equipe.",
      buttons: [{ id: "btn-final", label: "QUERO A MINHA VAGA AGORA", href: WHATSAPP_URL, variant: "primary" }],
      guarantees: [
        "Método com Marca Registrada ®",
        "Pagamento 100% Seguro",
        "Certificado de Conclusão Incluso",
        "Suporte Técnico por 180 Dias",
      ],
      ...SECTION_COLORS,
    },
    {
      type: "section-footer",
      h: 220,
      logoText: "Dra. Thaine Malinowski",
      logoSrc: "",
      tagline:
        "Especialista em harmonização corporal e criadora do Método LiftBumbum®. Transformando carreiras através da ciência e do posicionamento de luxo. Manaus/AM — Clínica de referência nacional.",
      copyright:
        "© 2026 Dra. Thaine Malinowski. Todos os direitos reservados. Método LiftBumbum® — Marca Registrada. Os resultados podem variar de profissional para profissional.",
      links: [
        { id: "fl1", label: "O Método", href: "#sobre-metodo" },
        { id: "fl2", label: "Cronograma", href: "#cronograma" },
        { id: "fl3", label: "Planos e Preços", href: "#planos" },
        { id: "fl4", label: "Depoimentos", href: "#resultados" },
        { id: "fl5", label: "Dúvidas", href: "#faq" },
        { id: "fl6", label: "WhatsApp", href: WHATSAPP_URL },
        { id: "fl7", label: "Instagram", href: "https://www.instagram.com/drathainemalinowski" },
      ],
      bgColor: MENTORIA_LIFTBUMBUM_TOKENS.bg,
      fgColor: MENTORIA_LIFTBUMBUM_TOKENS.fg,
      mutedColor: MENTORIA_LIFTBUMBUM_TOKENS.muted,
    },
  ]);

  const floatingButtons: TemplateElement = {
    type: "floating-buttons",
    x: 24,
    y: 96,
    w: 240,
    h: 56,
    whatsappEnabled: true,
    whatsappPhone: "+55 92 8606-2977",
    whatsappMessage: "Olá! Vim pelo site da Mentoria LiftBumbum® e quero saber mais.",
    backToTopEnabled: true,
    side: "right",
    bottomOffset: 20,
    bgColor: MENTORIA_LIFTBUMBUM_TOKENS.primary,
    fgColor: MENTORIA_LIFTBUMBUM_TOKENS.bg,
  };

  return [...sections, floatingButtons];
}
