// Datas comemorativas / feriados / mobilizações nacionais.
// Compartilhado entre o Calendário Workspace (privado) e o Calendário Público.

import dayjs, { Dayjs } from "dayjs";

export interface CalendarEventInfo {
  label: string;
  title: string;
  description: string;
  impact: string;
  tips: string[];
  color: "amber" | "indigo";
}

// ─── Helpers de cálculo ──────────────────────────────────────────────────────

function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = dayjs(new Date(year, month - 1, 1));
  const offset = (weekday - first.day() + 7) % 7;
  return first.add(offset + (n - 1) * 7, "day").format("YYYY-MM-DD");
}

function easterDate(year: number): Dayjs {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31);
  const dy = ((h + l - 7 * m + 114) % 31) + 1;
  return dayjs(new Date(year, mo - 1, dy));
}

export function buildVariableHolidays(
  years: Set<number>,
): Record<string, CalendarEventInfo> {
  const map: Record<string, CalendarEventInfo> = {};
  for (const year of years) {
    map[nthWeekday(year, 5, 0, 2)] = {
      label: "💐 Dia das Mães", color: "amber",
      title: "Dia das Mães",
      description:
        "Uma das datas com maior apelo emocional e comercial do Brasil — 2º domingo de maio. Flores, chocolates, joias, experiências e restaurantes lideram as vendas.",
      impact:
        "Altíssimo volume de vendas. Segunda data mais importante do varejo após o Natal.",
      tips: [
        "Lance campanha 3 semanas antes",
        "Ofereça kits e combos com frete grátis",
        "Crie urgência com contagem regressiva",
        "Ative e-mail marketing segmentado",
      ],
    };
    map[nthWeekday(year, 8, 0, 2)] = {
      label: "👨‍👧 Dia dos Pais", color: "amber",
      title: "Dia dos Pais",
      description:
        "Terceira data mais importante do varejo — 2º domingo de agosto. Forte apelo em eletrônicos, bebidas, experiências e moda masculina.",
      impact:
        "Alto volume de vendas em categorias masculinas. Oportunidade para restaurantes e experiências.",
      tips: [
        "Lance campanha 2 semanas antes",
        "Destaque eletrônicos, bebidas e experiências",
        "Crie combos e kits temáticos",
      ],
    };
    const corpus = easterDate(year).add(60, "day");
    map[corpus.format("YYYY-MM-DD")] = {
      label: "✝️ Corpus Christi", color: "amber",
      title: "Corpus Christi — Feriado Nacional",
      description:
        "Feriado religioso católico — sempre numa quinta-feira, 60 dias após a Páscoa. Muitas empresas fazem emenda até sexta-feira.",
      impact: "Feriado nacional. Muitos clientes em emenda de 4 dias.",
      tips: [
        "Verifique se clientes fazem emenda qui+sex",
        "Antecipe entregas e decisões para quarta-feira",
      ],
    };
  }
  return map;
}

// ─── Feriados fixos ("MM-DD") ────────────────────────────────────────────────

export const FIXED_HOLIDAYS: Record<string, CalendarEventInfo> = {
  "01-01": {
    label: "🎆 Confraternização Universal", color: "amber",
    title: "Ano Novo — Feriado Nacional",
    description:
      "Primeiro dia do ano, feriado nacional em todo o Brasil. Baixíssimo movimento comercial.",
    impact: "Operação reduzida. Maioria dos clientes e fornecedores offline.",
    tips: [
      "Programe automações de feliz ano novo",
      "Revise metas do ano anterior",
      "Prepare agenda da primeira semana",
    ],
  },
  "03-08": {
    label: "🌸 Dia da Mulher", color: "amber",
    title: "Dia Internacional da Mulher",
    description:
      "Data de conscientização e celebração dos direitos das mulheres. Grande oportunidade comercial em diversos segmentos.",
    impact: "Alto potencial de vendas em presentes, beleza, bem-estar e experiências.",
    tips: [
      "Crie campanhas temáticas com antecedência",
      "Destaque produtos/serviços voltados ao público feminino",
      "Reconheça as mulheres da sua equipe",
    ],
  },
  "04-21": {
    label: "⚔️ Tiradentes", color: "amber",
    title: "Tiradentes — Feriado Nacional",
    description:
      "Homenagem a Joaquim José da Silva Xavier, mártir da Inconfidência Mineira. Feriado nacional.",
    impact: "Operações encerradas. Fluxo de decisão pausado.",
    tips: [
      "Antecipe follow-ups para a semana anterior",
      "Use o período para planejamento interno",
    ],
  },
  "05-01": {
    label: "👷 Dia do Trabalho", color: "amber",
    title: "Dia do Trabalho — Feriado Nacional",
    description:
      "Celebração internacional dos trabalhadores. Feriado nacional no Brasil.",
    impact: "Sem operações comerciais. Equipes descansando.",
    tips: [
      "Valorize sua equipe com uma mensagem",
      "Revise contratos e acordos trabalhistas",
    ],
  },
  "06-12": {
    label: "💕 Dia dos Namorados", color: "amber",
    title: "Dia dos Namorados",
    description:
      "Uma das datas comerciais mais importantes do Brasil. Criada nos anos 1940 para aquecer o comércio.",
    impact:
      "Alto volume de vendas em joias, flores, restaurantes, experiências e presentes.",
    tips: [
      "Lance campanhas 2 semanas antes",
      "Ofereça kits e combos especiais",
      "Crie urgência com contagem regressiva",
    ],
  },
  "09-07": {
    label: "🇧🇷 Independência", color: "amber",
    title: "Independência do Brasil — Feriado Nacional",
    description:
      "Comemoração da proclamação da Independência do Brasil em 1822 por Dom Pedro I.",
    impact: "Feriado nacional. Sem operações comerciais.",
    tips: [
      "Crie conteúdo patriótico nas redes sociais",
      "Antecipe contatos importantes",
    ],
  },
  "10-12": {
    label: "🎈 Dia das Crianças", color: "amber",
    title: "Nossa Sra. Aparecida / Dia das Crianças",
    description:
      "Feriado religioso e comercial. Uma das datas mais aquecidas do varejo brasileiro.",
    impact:
      "Altíssimo volume de vendas em brinquedos, roupas infantis e entretenimento.",
    tips: [
      "Ative campanhas de brinquedos e presentes com 2 semanas de antecedência",
      "Crie promoções para pais e responsáveis",
    ],
  },
  "11-02": {
    label: "🕯️ Finados", color: "amber",
    title: "Finados — Feriado Nacional",
    description: "Dia de homenagem aos mortos. Feriado nacional com tom reflexivo.",
    impact: "Operações encerradas. Evite comunicações promocionais.",
    tips: [
      "Respeite o caráter da data — evite campanhas alegres",
      "Use para trabalho interno e planejamento",
    ],
  },
  "11-15": {
    label: "🏛️ República", color: "amber",
    title: "Proclamação da República — Feriado Nacional",
    description:
      "Comemoração da Proclamação da República Brasileira em 15 de novembro de 1889.",
    impact: "Feriado nacional. Pode ser emendado com o fim de semana.",
    tips: [
      "Verifique se clientes fazem emenda de feriado",
      "Antecipe entregas e decisões",
    ],
  },
  "11-20": {
    label: "✊ Consciência Negra", color: "amber",
    title: "Dia da Consciência Negra — Feriado Nacional",
    description:
      "Homenagem a Zumbi dos Palmares e celebração da cultura afro-brasileira. Feriado nacional desde 2024.",
    impact: "Feriado nacional. Oportunidade de posicionamento de marca inclusivo.",
    tips: [
      "Crie conteúdo sobre diversidade e inclusão",
      "Apoie causas ligadas à igualdade racial",
    ],
  },
  "12-24": {
    label: "🎄 Véspera de Natal", color: "amber",
    title: "Véspera de Natal",
    description:
      "Dia de celebração em família. Ponto de virada das compras de Natal — últimas aquisições.",
    impact:
      "Fechamentos antecipados. Fluxo de clientes físicos alto pela manhã.",
    tips: [
      "Envie mensagem de Natal para clientes e parceiros",
      "Confirme recebimento de pedidos urgentes",
    ],
  },
  "12-25": {
    label: "🎅 Natal", color: "amber",
    title: "Natal — Feriado Nacional",
    description:
      "A maior data comemorativa do Brasil. Feriado nacional de cunho religioso e familiar.",
    impact: "Sem operações. Equipes e clientes em família.",
    tips: [
      "Programe mensagem automática de Natal",
      "Planeje retorno das atividades para o dia 26",
    ],
  },
  "12-31": {
    label: "🎆 Réveillon", color: "amber",
    title: "Réveillon — Virada do Ano",
    description:
      "Última data do ano. Celebrações de fim de ano em todo o Brasil.",
    impact: "Operações encerradas cedo. Foco em comemorações.",
    tips: [
      "Envie mensagem de encerramento do ano",
      "Programe automações de Feliz Ano Novo para meia-noite",
    ],
  },
};

export function getHoliday(
  date: Dayjs,
  variableHolidays: Record<string, CalendarEventInfo>,
): CalendarEventInfo | null {
  return (
    FIXED_HOLIDAYS[date.format("MM-DD")] ??
    variableHolidays[date.format("YYYY-MM-DD")] ??
    null
  );
}

// ─── Eventos de Mobilização Nacional ("YYYY-MM-DD") ─────────────────────────

export const MOBILIZATION_EVENTS: Record<string, CalendarEventInfo> = {
  // Carnaval 2026
  "2026-02-14": { label: "🎉 Carnaval", color: "indigo", title: "Carnaval 2026 — Sábado", description: "Início do período carnavalesco. Brasil entra no maior festival popular do mundo.", impact: "Queda brusca na produtividade. Foco em entretenimento e turismo.", tips: ["Antecipe entregas da semana anterior", "Programe automações de atendimento", "Considere campanhas temáticas"] },
  "2026-02-15": { label: "🎉 Carnaval", color: "indigo", title: "Carnaval 2026 — Domingo", description: "Segundo dia do carnaval. Blocos e desfiles em todo o Brasil.", impact: "Operações mínimas. Alto absenteísmo.", tips: ["Mantenha atendimento automatizado ativo"] },
  "2026-02-16": { label: "🎉 Carnaval", color: "indigo", title: "Carnaval 2026 — Segunda-feira", description: "Ponto alto do Carnaval. Feriado em muitas cidades brasileiras.", impact: "Operações encerradas na maioria das regiões.", tips: ["Confirme feriado municipal de cada cliente", "Não envie e-mails comerciais hoje"] },
  "2026-02-17": { label: "🎉 Terça-feira Gorda", color: "indigo", title: "Carnaval 2026 — Terça-feira Gorda", description: "Ápice do Carnaval brasileiro. Maior mobilização popular do período.", impact: "Brasil praticamente parado. Zero decisões de negócio.", tips: ["Retome contatos na Quarta de Cinzas à tarde"] },
  "2026-02-18": { label: "🕊️ Quarta de Cinzas", color: "indigo", title: "Quarta-feira de Cinzas 2026", description: "Fim do Carnaval. Retorno gradual das atividades a partir da tarde.", impact: "Retomada lenta pela manhã, aceleração à tarde.", tips: ["Envie e-mail de retorno ao mercado à tarde", "Retome follow-ups pendentes do pré-carnaval"] },
  // Semana do Consumidor 2026
  "2026-03-15": { label: "🛒 Semana do Consumidor", color: "indigo", title: "Semana do Consumidor 2026 — Dia 1", description: "Início da Semana do Consumidor, um dos maiores eventos de e-commerce do Brasil. Criada em torno do dia 15 de março (Dia do Consumidor).", impact: "Altíssimo volume de buscas e compras online. Concorrência acirrada em anúncios.", tips: ["Ative campanhas com descontos progressivos", "Reforce estoque e atendimento", "Monitore métricas de conversão em tempo real"] },
  "2026-03-20": { label: "🛒 Semana do Consumidor", color: "indigo", title: "Semana do Consumidor 2026 — Pico", description: "Pico de vendas da Semana do Consumidor. Consumidores mais propensos a fechar negócio.", impact: "Máximo volume de transações do período.", tips: ["Prepare ofertas-relâmpago", "Ative urgência com contagem regressiva"] },
  "2026-03-21": { label: "🛒 Semana do Consumidor", color: "indigo", title: "Semana do Consumidor 2026 — Último Dia", description: "Encerramento da Semana do Consumidor. Última chance para ativações promocionais.", impact: "Consumidores com senso de urgência elevado.", tips: ["Crie oferta de última hora", "Estenda prazo de entrega para converter indecisos"] },
  // Páscoa 2026
  "2026-04-03": { label: "✝️ Sexta-feira Santa", color: "indigo", title: "Sexta-feira Santa 2026 — Feriado Nacional", description: "Feriado religioso nacional que marca a crucificação de Jesus Cristo. Um dos feriados mais respeitados do Brasil.", impact: "Feriado nacional. Operações encerradas.", tips: ["Antecipe comunicações para quinta-feira", "Evite campanhas comerciais hoje"] },
  "2026-04-05": { label: "🐣 Páscoa", color: "indigo", title: "Páscoa 2026", description: "A segunda maior data comercial do Brasil após o Natal. Forte apelo em chocolates, ovos de Páscoa e presentes.", impact: "Alto volume em alimentos, chocolates e confeitaria. Restaurantes lotados.", tips: ["Crie kits e cestas temáticas", "Ative campanhas de 'último ovo'", "Ofereça frete expresso para pedidos de última hora"] },
  // Copa do Mundo 2026
  "2026-06-11": { label: "⚽ Copa do Mundo — Abertura", color: "indigo", title: "Copa do Mundo 2026 — Cerimônia de Abertura", description: "A Copa do Mundo FIFA 2026 acontece nos Estados Unidos, Canadá e México. Maior evento esportivo do planeta, com 48 seleções participantes pela primeira vez na história.", impact: "Mobilização nacional massiva. Brasil em modo Copa a partir desta data.", tips: ["Planeje campanhas temáticas de Copa", "Adapte horário de reuniões para dias de jogos do Brasil", "Crie promoções vinculadas a resultados"] },
  "2026-06-18": { label: "🇧🇷 Brasil na Copa", color: "indigo", title: "Copa do Mundo 2026 — Jogo do Brasil (1ª Fase)", description: "Primeiro jogo do Brasil na Copa do Mundo 2026. O Brasil busca o hexa campeonato mundial.", impact: "Brasil paralisa durante o jogo (estimativa: 2h). Produtividade baixa no dia todo.", tips: ["Evite reuniões no horário do jogo", "Crie campanha temática comemorando o Brasil", "Use o jogo como tema em conteúdo nas redes"] },
  "2026-06-24": { label: "🇧🇷 Brasil na Copa", color: "indigo", title: "Copa do Mundo 2026 — Jogo do Brasil (2ª Fase)", description: "Segundo jogo da fase de grupos do Brasil. Expectativa nacional em alta.", impact: "Alto engajamento nas redes sociais. Foco total no jogo.", tips: ["Programe posts ao vivo", "Aproveite o engajamento para impulsionar campanhas"] },
  "2026-06-29": { label: "🇧🇷 Brasil na Copa", color: "indigo", title: "Copa do Mundo 2026 — Jogo do Brasil (3ª Fase)", description: "Terceiro e último jogo do Brasil na fase de grupos. Classificação em jogo.", impact: "Tensão nacional. Baixíssima produtividade no horário do jogo.", tips: ["Libere a equipe para assistir ao jogo", "Prepare post de comemoração com antecedência"] },
  "2026-07-04": { label: "⚽ Copa — Oitavas", color: "indigo", title: "Copa do Mundo 2026 — Oitavas de Final", description: "Fase eliminatória começa. Cada derrota elimina uma seleção. Brasil deve estar presente se avançar.", impact: "Atenção nacional às partidas. Jogos de tarde e noite no horário de Brasília.", tips: ["Acompanhe a tabela de jogos para planejar a agenda"] },
  "2026-07-15": { label: "⚽ Copa — Semifinais", color: "indigo", title: "Copa do Mundo 2026 — Semifinais", description: "Penúltima fase da Copa. As 4 melhores seleções do mundo disputam uma vaga na final.", impact: "Máximo de engajamento se Brasil estiver. País paralisa.", tips: ["Prepare campanha 'Brasil na Final'", "Flexibilize o expediente para os semifinalistas"] },
  "2026-07-19": { label: "🏆 Final da Copa", color: "indigo", title: "Copa do Mundo 2026 — Grande Final", description: "A grande final da Copa do Mundo FIFA 2026. Se o Brasil for campeão, maior festa da história recente do país.", impact: "Dia histórico independente do resultado. Paralisa o Brasil se o Brasil jogar.", tips: ["Prepare posts para os dois cenários (vitória e derrota)", "Use a data como gatilho emocional em campanhas", "Programe conteúdo comemorativo"] },
  // Eleições 2026
  "2026-10-04": { label: "🗳️ Eleições — 1º Turno", color: "indigo", title: "Eleições Gerais 2026 — 1º Turno", description: "Eleições para Presidente, Governadores, Senadores e Deputados. Um dos maiores eventos cívicos do Brasil, com mais de 150 milhões de eleitores.", impact: "Feriado eleitoral. Operações encerradas. Polarização política nas redes.", tips: ["Evite posicionamento político em comunicações", "Respeite o silêncio eleitoral (48h antes)", "Antecipe follow-ups para a semana anterior"] },
  "2026-10-25": { label: "🗳️ Eleições — 2º Turno", color: "indigo", title: "Eleições Gerais 2026 — 2º Turno", description: "Segundo turno para Presidente e Governadores não eleitos no 1º turno. Tensão política e climática máxima.", impact: "Feriado eleitoral. Incerteza de mercado até o resultado.", tips: ["Evite anúncios e campanhas neste dia", "Prepare comunicação pós-resultado para o dia seguinte", "Acompanhe impacto econômico pós-eleição"] },
  // Black Friday 2026
  "2026-11-27": { label: "🛍️ Black Friday", color: "indigo", title: "Black Friday 2026", description: "A maior data de vendas do Brasil. Surgiu nos EUA mas tomou conta do varejo brasileiro. Bilhões movimentados em um único dia.", impact: "Pico absoluto de vendas online. Maior volume de transações do ano.", tips: ["Prepare ofertas exclusivas com 30 dias de antecedência", "Reforce infraestrutura de atendimento e entrega", "Crie landing pages específicas", "Aqueça a lista de e-mails com 'esquenta Black Friday'"] },
  "2026-11-30": { label: "💻 Cyber Monday", color: "indigo", title: "Cyber Monday 2026", description: "Segunda-feira após a Black Friday. Foco em tecnologia e produtos digitais. Volume ainda alto de compras.", impact: "Segundo maior dia de e-commerce da semana.", tips: ["Estenda ofertas de tecnologia e software", "Reative leads que não converteram na Black Friday"] },
  // Carnaval 2027
  "2027-02-06": { label: "🎉 Carnaval 2027", color: "indigo", title: "Carnaval 2027 — Sábado", description: "Início do Carnaval 2027. Mesmo cenário do ano anterior: Brasil entra em modo festa.", impact: "Queda de produtividade. Foco em celebração.", tips: ["Antecipe entregas da semana", "Ative atendimento automatizado"] },
  "2027-02-09": { label: "🎉 Terça Gorda 2027", color: "indigo", title: "Carnaval 2027 — Terça-feira Gorda", description: "Ponto culminante do Carnaval 2027.", impact: "Brasil totalmente parado.", tips: ["Retome contatos na Quarta-feira de Cinzas à tarde"] },
  "2027-02-10": { label: "🕊️ Cinzas 2027", color: "indigo", title: "Quarta-feira de Cinzas 2027", description: "Encerramento do Carnaval 2027. Retomada gradual das atividades.", impact: "Retomada lenta pela manhã.", tips: ["Envie e-mail de retorno à tarde"] },
  // Páscoa 2027
  "2027-03-26": { label: "✝️ Sexta Santa 2027", color: "indigo", title: "Sexta-feira Santa 2027 — Feriado Nacional", description: "Feriado religioso nacional.", impact: "Operações encerradas.", tips: ["Antecipe comunicações para quinta-feira"] },
  "2027-03-28": { label: "🐣 Páscoa 2027", color: "indigo", title: "Páscoa 2027", description: "Segunda maior data comercial do Brasil. Oportunidade em chocolates, presentes e experiências.", impact: "Alto volume em alimentos e presentes.", tips: ["Lance kits temáticos com antecedência", "Ative campanha de última hora"] },
  // Eleições Municipais 2028
  "2028-10-01": { label: "🗳️ Eleições Municipais", color: "indigo", title: "Eleições Municipais 2028 — 1º Turno", description: "Eleições para Prefeitos e Vereadores em todo o Brasil.", impact: "Feriado eleitoral. Operações encerradas.", tips: ["Evite posicionamento político", "Antecipe follow-ups para semana anterior"] },
  "2028-10-29": { label: "🗳️ Eleições Municipais", color: "indigo", title: "Eleições Municipais 2028 — 2º Turno", description: "Segundo turno para Prefeitos não eleitos no 1º turno.", impact: "Feriado eleitoral.", tips: ["Prepare comunicação pós-resultado"] },
};

export function getMobilizationEvent(date: Dayjs): CalendarEventInfo | null {
  return MOBILIZATION_EVENTS[date.format("YYYY-MM-DD")] ?? null;
}
