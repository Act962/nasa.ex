"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/pt-br";
import { ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { imgSrc } from "@/features/public-calendar/utils/img-src";
import { useUpdateAction } from "@/features/actions/hooks/use-tasks";

dayjs.locale("pt-br");

interface CalendarEventInfo {
  label: string;
  title: string;
  description: string;
  impact: string;
  tips: string[];
  color: "amber" | "indigo";
}

// ── Helpers: datas variáveis ─────────────────────────────────────────────────
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

function buildVariableHolidays(years: Set<number>): Record<string, CalendarEventInfo> {
  const map: Record<string, CalendarEventInfo> = {};
  for (const year of years) {
    map[nthWeekday(year, 5, 0, 2)] = {
      label: "💐 Dia das Mães", color: "amber",
      title: "Dia das Mães",
      description: "Uma das datas com maior apelo emocional e comercial do Brasil — 2º domingo de maio. Flores, chocolates, joias, experiências e restaurantes lideram as vendas.",
      impact: "Altíssimo volume de vendas. Segunda data mais importante do varejo após o Natal.",
      tips: ["Lance campanha 3 semanas antes", "Ofereça kits e combos com frete grátis", "Crie urgência com contagem regressiva", "Ative e-mail marketing segmentado"],
    };
    map[nthWeekday(year, 8, 0, 2)] = {
      label: "👨‍👧 Dia dos Pais", color: "amber",
      title: "Dia dos Pais",
      description: "Terceira data mais importante do varejo — 2º domingo de agosto. Forte apelo em eletrônicos, bebidas, experiências e moda masculina.",
      impact: "Alto volume de vendas em categorias masculinas. Oportunidade para restaurantes e experiências.",
      tips: ["Lance campanha 2 semanas antes", "Destaque eletrônicos, bebidas e experiências", "Crie combos e kits temáticos"],
    };
    const corpus = easterDate(year).add(60, "day");
    map[corpus.format("YYYY-MM-DD")] = {
      label: "✝️ Corpus Christi", color: "amber",
      title: "Corpus Christi — Feriado Nacional",
      description: "Feriado religioso católico — sempre numa quinta-feira, 60 dias após a Páscoa. Muitas empresas fazem emenda até sexta-feira.",
      impact: "Feriado nacional. Muitos clientes em emenda de 4 dias.",
      tips: ["Verifique se clientes fazem emenda qui+sex", "Antecipe entregas e decisões para quarta-feira"],
    };
  }
  return map;
}

// ── Feriados fixos: "MM-DD" ──────────────────────────────────────────────────
const FIXED_HOLIDAYS: Record<string, CalendarEventInfo> = {
  "01-01": {
    label: "🎆 Confraternização Universal", color: "amber",
    title: "Ano Novo — Feriado Nacional",
    description: "Primeiro dia do ano, feriado nacional em todo o Brasil. Baixíssimo movimento comercial.",
    impact: "Operação reduzida. Maioria dos clientes e fornecedores offline.",
    tips: ["Programe automações de feliz ano novo", "Revise metas do ano anterior", "Prepare agenda da primeira semana"],
  },
  "03-08": {
    label: "🌸 Dia da Mulher", color: "amber",
    title: "Dia Internacional da Mulher",
    description: "Data de conscientização e celebração dos direitos das mulheres. Grande oportunidade comercial em diversos segmentos.",
    impact: "Alto potencial de vendas em presentes, beleza, bem-estar e experiências.",
    tips: ["Crie campanhas temáticas com antecedência", "Destaque produtos/serviços voltados ao público feminino", "Reconheça as mulheres da sua equipe"],
  },
  "04-21": {
    label: "⚔️ Tiradentes", color: "amber",
    title: "Tiradentes — Feriado Nacional",
    description: "Homenagem a Joaquim José da Silva Xavier, mártir da Inconfidência Mineira. Feriado nacional.",
    impact: "Operações encerradas. Fluxo de decisão pausado.",
    tips: ["Antecipe follow-ups para a semana anterior", "Use o período para planejamento interno"],
  },
  "05-01": {
    label: "👷 Dia do Trabalho", color: "amber",
    title: "Dia do Trabalho — Feriado Nacional",
    description: "Celebração internacional dos trabalhadores. Feriado nacional no Brasil.",
    impact: "Sem operações comerciais. Equipes descansando.",
    tips: ["Valorize sua equipe com uma mensagem", "Revise contratos e acordos trabalhistas"],
  },
  "09-07": {
    label: "🇧🇷 Independência", color: "amber",
    title: "Independência do Brasil — Feriado Nacional",
    description: "Comemoração da proclamação da Independência do Brasil em 1822 por Dom Pedro I.",
    impact: "Feriado nacional. Sem operações comerciais.",
    tips: ["Crie conteúdo patriótico nas redes sociais", "Antecipe contatos importantes"],
  },
  "10-12": {
    label: "🎈 Dia das Crianças", color: "amber",
    title: "Nossa Sra. Aparecida / Dia das Crianças",
    description: "Feriado religioso e comercial. Uma das datas mais aquecidas do varejo brasileiro.",
    impact: "Altíssimo volume de vendas em brinquedos, roupas infantis e entretenimento.",
    tips: ["Ative campanhas de brinquedos e presentes com 2 semanas de antecedência", "Crie promoções para pais e responsáveis"],
  },
  "11-02": {
    label: "🕯️ Finados", color: "amber",
    title: "Finados — Feriado Nacional",
    description: "Dia de homenagem aos mortos. Feriado nacional com tom reflexivo.",
    impact: "Operações encerradas. Evite comunicações promocionais.",
    tips: ["Respeite o caráter da data — evite campanhas alegres", "Use para trabalho interno e planejamento"],
  },
  "11-15": {
    label: "🏛️ República", color: "amber",
    title: "Proclamação da República — Feriado Nacional",
    description: "Comemoração da Proclamação da República Brasileira em 15 de novembro de 1889.",
    impact: "Feriado nacional. Pode ser emendado com o fim de semana.",
    tips: ["Verifique se clientes fazem emenda de feriado", "Antecipe entregas e decisões"],
  },
  "11-20": {
    label: "✊ Consciência Negra", color: "amber",
    title: "Dia da Consciência Negra — Feriado Nacional",
    description: "Homenagem a Zumbi dos Palmares e celebração da cultura afro-brasileira. Feriado nacional desde 2024.",
    impact: "Feriado nacional. Oportunidade de posicionamento de marca inclusivo.",
    tips: ["Crie conteúdo sobre diversidade e inclusão", "Apoie causas ligadas à igualdade racial"],
  },
  "12-24": {
    label: "🎄 Véspera de Natal", color: "amber",
    title: "Véspera de Natal",
    description: "Dia de celebração em família. Ponto de virada das compras de Natal — últimas aquisições.",
    impact: "Fechamentos antecipados. Fluxo de clientes físicos alto pela manhã.",
    tips: ["Envie mensagem de Natal para clientes e parceiros", "Confirme recebimento de pedidos urgentes"],
  },
  "12-25": {
    label: "🎅 Natal", color: "amber",
    title: "Natal — Feriado Nacional",
    description: "A maior data comemorativa do Brasil. Feriado nacional de cunho religioso e familiar.",
    impact: "Sem operações. Equipes e clientes em família.",
    tips: ["Programe mensagem automática de Natal", "Planeje retorno das atividades para o dia 26"],
  },
  "12-31": {
    label: "🎆 Réveillon", color: "amber",
    title: "Réveillon — Virada do Ano",
    description: "Última data do ano. Celebrações de fim de ano em todo o Brasil.",
    impact: "Operações encerradas cedo. Foco em comemorações.",
    tips: ["Envie mensagem de encerramento do ano", "Programe automações de Feliz Ano Novo para meia-noite"],
  },
  "06-12": {
    label: "💕 Dia dos Namorados", color: "amber",
    title: "Dia dos Namorados",
    description: "Uma das datas comerciais mais importantes do Brasil. Criada nos anos 1940 para aquecer o comércio.",
    impact: "Alto volume de vendas em joias, flores, restaurantes, experiências e presentes.",
    tips: ["Lance campanhas 2 semanas antes", "Ofereça kits e combos especiais", "Crie urgência com contagem regressiva"],
  },
};

function getHoliday(date: Dayjs, variableHolidays: Record<string, CalendarEventInfo>): CalendarEventInfo | null {
  return FIXED_HOLIDAYS[date.format("MM-DD")] ?? variableHolidays[date.format("YYYY-MM-DD")] ?? null;
}

// ── Eventos de Mobilização Nacional: "YYYY-MM-DD" ────────────────────────────
const MOBILIZATION_EVENTS: Record<string, CalendarEventInfo> = {
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

function getMobilizationEvent(date: Dayjs): CalendarEventInfo | null {
  return MOBILIZATION_EVENTS[date.format("YYYY-MM-DD")] ?? null;
}

export interface WorkspaceCalendarAction {
  id: string;
  title: string;
  dueDate: Date | string | null;
  startDate: Date | string | null;
  endDate?: Date | string | null;
  priority?: string | null;
  isDone?: boolean;
  coverImage?: string | null;
  workspaceId?: string | null;
  workspace?: {
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
    coverImage?: string | null;
  } | null;
  // Cliente/Projeto (entidade unificada — type "client" | "project" | "entity")
  orgProjectId?: string | null;
  orgProject?: {
    id: string;
    name: string;
    type?: string | null;
    color?: string | null;
    avatar?: string | null;
  } | null;
  // Tracking (pipeline/funil)
  trackingId?: string | null;
  tracking?: { id: string; name: string } | null;
  // Lead específico
  leadId?: string | null;
  lead?: { id: string; name: string; email?: string | null } | null;
  createdBy?: string;
  user?: { id: string; name: string; image?: string | null } | null;
  participants?: Array<{
    userId: string;
    user?: { id: string; name: string; image?: string | null } | null;
  }>;
  responsibles?: Array<{
    userId: string;
    user?: { id: string; name: string; image?: string | null } | null;
  }>;
}

interface MonthGridProps {
  actions: WorkspaceCalendarAction[];
  workspaceColorMap: Record<string, string>;
  cursor: Dayjs;
  onCursorChange: (cursor: Dayjs) => void;
  onSelect: (action: WorkspaceCalendarAction) => void;
  selectedId?: string | null;
  /** Click em área vazia da célula. Recebe o dia clicado. */
  onCreateForDate?: (date: Dayjs) => void;
  /** Quando informado, mostra ícone de "+" no hover da célula. */
  showCreateOnHover?: boolean;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_VISIBLE = 4;
const CARD_HEIGHT = 52;
const CARD_GAP = 5;
const CELL_PADDING = 5;
const PLUS_MORE_HEIGHT = 25;
const EMPTY_ROW_HEIGHT = 56;

function isEmoji(value?: string | null): value is string {
  return !!value && !value.startsWith("http") && !value.startsWith("/") && value.length <= 4;
}

/** Drop zone transparente que ocupa todo o cell — registra `useDroppable`
 *  com id "day-YYYY-MM-DD". Quando um card é dropado dentro do cell,
 *  o handler `onDragEnd` recebe `over.id = "day-YYYY-MM-DD"`. */
function DropZone({ dayKey }: { dayKey: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "pointer-events-none absolute inset-0 z-0 rounded-lg transition-colors",
        isOver && "bg-primary/15 ring-2 ring-primary/60",
      )}
    />
  );
}

function MiniCard({
  action,
  color,
  selected,
  onSelect,
  draggable = false,
}: {
  action: WorkspaceCalendarAction;
  color: string;
  selected: boolean;
  onSelect: (a: WorkspaceCalendarAction) => void;
  draggable?: boolean;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [wsCoverFailed, setWsCoverFailed] = useState(false);
  const [creatorImgFailed, setCreatorImgFailed] = useState(false);

  // DnD — só ativa quando draggable=true (evita custo em modos não-drag)
  const drag = useDraggable({
    id: `action-${action.id}`,
    data: { action },
    disabled: !draggable,
  });

  const dateStr = action.dueDate || action.startDate;
  const time = dateStr ? dayjs(dateStr).format("HH:mm") : "";

  // Fallback chain: action.coverImage → workspace.coverImage → creator avatar → emoji/cor
  const actionCover =
    action.coverImage && !coverFailed ? imgSrc(action.coverImage) : null;
  const workspaceCover =
    !actionCover && action.workspace?.coverImage && !wsCoverFailed
      ? imgSrc(action.workspace.coverImage)
      : null;
  const creatorAvatar =
    !actionCover && !workspaceCover && action.user?.image && !creatorImgFailed
      ? imgSrc(action.user.image)
      : null;
  const wsEmoji = !actionCover && !workspaceCover && !creatorAvatar
    ? (isEmoji(action.workspace?.icon) ? action.workspace?.icon : null)
    : null;

  return (
    <button
      ref={draggable ? drag.setNodeRef : undefined}
      type="button"
      onClick={(e) => {
        // Não dispara onSelect durante drag (drag-kit já bloqueia o click no fim)
        if (drag.isDragging) {
          e.preventDefault();
          return;
        }
        onSelect(action);
      }}
      {...(draggable ? drag.attributes : {})}
      {...(draggable ? drag.listeners : {})}
      className={cn(
        "group relative h-[52px] w-full overflow-hidden rounded-md transition",
        selected ? "ring-2 ring-primary" : "hover:ring-2 hover:ring-primary/60",
        draggable && "cursor-grab active:cursor-grabbing",
        drag.isDragging && "opacity-40",
      )}
      style={{
        backgroundColor: color,
        // Quando em drag, deixamos o DragOverlay renderizar o "fantasma" — só
        // baixamos a opacidade aqui pra dar feedback visual.
      }}
      title={action.title}
    >
      {/* Camada de fallback SEMPRE presente: gradient + inicial grande.
          Garante que mesmo sem imagem o card tenha visual bonito. As imagens
          (quando existem) renderizam por cima. */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 60%, ${color}80 100%)`,
        }}
      >
        <span className="text-2xl font-bold text-white/30 select-none">
          {action.title.charAt(0).toUpperCase()}
        </span>
      </div>

      {actionCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={actionCover}
          alt={action.title}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : workspaceCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={workspaceCover}
          alt={action.workspace?.name ?? ""}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          onError={() => setWsCoverFailed(true)}
        />
      ) : creatorAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={creatorAvatar}
          alt={action.user?.name ?? ""}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setCreatorImgFailed(true)}
        />
      ) : wsEmoji ? (
        <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-60">
          {wsEmoji}
        </div>
      ) : null}

      {/* Banner inferior com título + horário */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-1.5 pb-1 pt-6">
        <div className="truncate text-[9px] font-bold leading-tight text-white drop-shadow">
          {action.isDone ? "✓ " : ""}
          {action.title}
        </div>
        {time && (
          <div className="text-[8px] font-medium text-white/90">{time}</div>
        )}
      </div>

      {/* Workspace tag no topo esquerdo */}
      {action.workspace?.name && (
        <div className="absolute left-1.5 top-1.5 max-w-[60%] truncate rounded bg-black/60 px-1 py-0.5 text-[8px] font-semibold text-white backdrop-blur-sm">
          {action.workspace.name}
        </div>
      )}

      {/* Cliente/Projeto (orgProject) ou Lead — topo direito */}
      {action.orgProject?.name ? (
        <div
          className="absolute right-1.5 top-1.5 max-w-[55%] truncate rounded px-1 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm"
          style={{
            backgroundColor: action.orgProject.color
              ? `${action.orgProject.color}E6`
              : "rgba(0,0,0,0.6)",
          }}
          title={`${action.orgProject.type === "client" ? "Cliente" : "Projeto"}: ${action.orgProject.name}`}
        >
          {action.orgProject.type === "client" ? "👤 " : "📁 "}
          {action.orgProject.name}
        </div>
      ) : action.lead?.name ? (
        <div
          className="absolute right-1.5 top-1.5 max-w-[55%] truncate rounded bg-amber-500/80 px-1 py-0.5 text-[8px] font-bold text-white backdrop-blur-sm"
          title={`Lead: ${action.lead.name}`}
        >
          👤 {action.lead.name}
        </div>
      ) : null}
    </button>
  );
}

export function WorkspaceCalendarMonthGrid({
  actions,
  workspaceColorMap,
  cursor,
  onCursorChange,
  onSelect,
  selectedId,
  onCreateForDate,
  showCreateOnHover,
}: MonthGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);

  // ── DnD: arrastar evento entre dias muda dueDate da action ───────────────
  const updateAction = useUpdateAction();
  const [draggingAction, setDraggingAction] =
    useState<WorkspaceCalendarAction | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = (e: DragStartEvent) => {
    const a = (e.active.data.current as { action?: WorkspaceCalendarAction })?.action;
    if (a) setDraggingAction(a);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingAction(null);
    const action = (e.active.data.current as { action?: WorkspaceCalendarAction })
      ?.action;
    const dropDayKey = e.over?.id as string | undefined;
    if (!action || !dropDayKey || !dropDayKey.startsWith("day-")) return;
    const targetDay = dropDayKey.slice(4); // "day-YYYY-MM-DD"

    // Não move se cair no mesmo dia (evita mutation desnecessária)
    const currentDate = action.dueDate || action.startDate;
    const currentKey = currentDate
      ? dayjs(currentDate).format("YYYY-MM-DD")
      : null;
    if (currentKey === targetDay) return;

    // Preserva o horário (HH:mm:ss) original quando mover
    const originalTime = currentDate
      ? dayjs(currentDate)
      : dayjs().hour(9).minute(0).second(0);
    const newDate = dayjs(targetDay)
      .hour(originalTime.hour())
      .minute(originalTime.minute())
      .second(originalTime.second())
      .toDate();

    updateAction.mutate(
      {
        actionId: action.id,
        dueDate: newDate,
      } as any,
      {
        onSuccess: () => {
          toast.success(
            `Movido para ${dayjs(targetDay).format("DD [de] MMMM")}`,
          );
        },
        onError: (err) => {
          toast.error(`Falha ao mover: ${(err as Error).message}`);
        },
      },
    );
  };

  const actionsByDay = useMemo(() => {
    const map = new Map<string, WorkspaceCalendarAction[]>();
    for (const a of actions) {
      const dateStr = a.dueDate || a.startDate;
      if (!dateStr) continue;
      const key = dayjs(dateStr).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [actions]);

  const grid = useMemo(() => {
    const startOfMonth = cursor.startOf("month");
    const firstDayOfGrid = startOfMonth.subtract(startOfMonth.day(), "day");
    const days: Dayjs[] = [];
    for (let i = 0; i < 42; i++) days.push(firstDayOfGrid.add(i, "day"));
    return days;
  }, [cursor]);

  const variableHolidays = useMemo(() => {
    const years = new Set(grid.map((d) => d.year()));
    return buildVariableHolidays(years);
  }, [grid]);

  const rowHeights = useMemo(() => {
    const heights: number[] = [];
    for (let i = 0; i < grid.length; i += 7) {
      const row = grid.slice(i, i + 7);
      let maxCards = 0;
      let rowHasOverflow = false;
      for (const day of row) {
        const key = day.format("YYYY-MM-DD");
        const count = actionsByDay.get(key)?.length ?? 0;
        maxCards = Math.max(maxCards, Math.min(count, MAX_VISIBLE));
        if (count > MAX_VISIBLE) rowHasOverflow = true;
      }
      if (maxCards === 0) {
        heights.push(EMPTY_ROW_HEIGHT);
      } else {
        const base =
          2 * CELL_PADDING +
          maxCards * CARD_HEIGHT +
          (maxCards - 1) * CARD_GAP;
        heights.push(rowHasOverflow ? base + CARD_GAP + PLUS_MORE_HEIGHT : base);
      }
    }
    return heights;
  }, [grid, actionsByDay]);

  const today = dayjs().startOf("day");

  useEffect(() => {
    const isCurrentMonth = cursor.isSame(dayjs(), "month");
    if (!isCurrentMonth) return;

    const timer = setTimeout(() => {
      if (todayCellRef.current && gridRef.current) {
        const cell = todayCellRef.current;
        const container = gridRef.current;
        const cellRect = cell.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTarget =
          container.scrollTop + (cellRect.top - containerRect.top) - 4;
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [cursor]);

  const getColor = (a: WorkspaceCalendarAction) =>
    a.workspaceId ? workspaceColorMap[a.workspaceId] ?? "#7c3aed" : "#7c3aed";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingAction(null)}
    >
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xl font-bold capitalize">
          <span>{cursor.format("MMMM")}</span>
          <span className="ml-2 font-normal text-muted-foreground">
            {cursor.format("YYYY")}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onCursorChange(dayjs().startOf("month"))}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCursorChange(cursor.subtract(1, "month"))}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCursorChange(cursor.add(1, "month"))}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-3">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        className="grid flex-1 grid-cols-7 gap-1 overflow-auto px-3 pb-3"
        style={{
          gridTemplateRows: rowHeights.map((h) => `${h}px`).join(" "),
          alignContent: "start",
        }}
      >
        {grid.map((day) => {
          const dayKey = day.format("YYYY-MM-DD");
          const dayActions = actionsByDay.get(dayKey) ?? [];
          const isOutside = !day.isSame(cursor, "month");
          const isToday = day.isSame(today, "day");
          const overflow = dayActions.length - MAX_VISIBLE;
          const holiday = getHoliday(day, variableHolidays);
          const mobilization = getMobilizationEvent(day);
          const hasTopLabel = !!(holiday || mobilization);

          return (
            <div
              key={dayKey}
              ref={isToday ? todayCellRef : undefined}
              onClick={(e) => {
                // Só dispara em click na área vazia da célula — clicks em
                // cards / popovers / "+" param via stopPropagation neles.
                if (onCreateForDate && e.target === e.currentTarget) {
                  onCreateForDate(day);
                }
              }}
              className={cn(
                "group relative overflow-hidden rounded-lg",
                onCreateForDate && "cursor-pointer",
                isToday
                  ? "bg-primary/15 ring-1 ring-primary/40"
                  : isOutside
                    ? "bg-violet-500/8"
                    : "bg-card/60",
              )}
              style={{ padding: `${CELL_PADDING}px` }}
            >
              {/* Drop zone — registra useDroppable("day-YYYY-MM-DD") */}
              <DropZone dayKey={dayKey} />

              {/* Número do dia */}
              <div
                className={cn(
                  "pointer-events-none absolute left-[5px] top-[5px] z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-sm",
                  isToday && "bg-primary text-primary-foreground",
                  isOutside &&
                    !isToday &&
                    "bg-background/50 text-muted-foreground/50",
                  !isToday &&
                    !isOutside &&
                    "bg-background/85 text-foreground/90 backdrop-blur-sm",
                )}
              >
                {day.date()}
              </div>

              {/* Botão "+" pra criar evento (visível no hover) */}
              {showCreateOnHover && onCreateForDate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateForDate(day);
                  }}
                  title={`Criar evento em ${day.format("DD/MM/YYYY")}`}
                  className="absolute right-[5px] top-[5px] z-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-sm transition-opacity hover:scale-110 group-hover:opacity-100"
                >
                  <Plus className="size-3.5" />
                </button>
              )}

              {(holiday || mobilization) && (
                <div className="absolute left-0 right-0 top-[28px] z-20 flex flex-col gap-0.5 px-[5px]">
                  {[holiday, mobilization].filter(Boolean).map((ev, i) => (
                    <Popover key={i}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-opacity hover:opacity-80",
                            ev!.color === "amber"
                              ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                              : "bg-indigo-400/20 text-indigo-700 dark:text-indigo-300",
                          )}
                        >
                          {ev!.label}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start" side="right">
                        <div className="p-3 pb-2">
                          <p className="text-sm font-semibold leading-tight">{ev!.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{ev!.description}</p>
                        </div>
                        <div className={cn(
                          "mx-3 mb-2 rounded px-2 py-1.5 text-xs",
                          ev!.color === "amber"
                            ? "bg-amber-400/15 text-amber-800 dark:text-amber-300"
                            : "bg-indigo-400/15 text-indigo-800 dark:text-indigo-300",
                        )}>
                          <span className="font-semibold">Impacto: </span>{ev!.impact}
                        </div>
                        <div className="border-t px-3 py-2">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dicas de ação</p>
                          <ul className="space-y-0.5">
                            {ev!.tips.map((tip, ti) => (
                              <li key={ti} className="flex gap-1.5 text-xs text-foreground/80">
                                <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              )}

              {dayActions.length > 0 && (
                <div
                  className="flex h-full flex-col"
                  style={{
                    gap: `${CARD_GAP}px`,
                    paddingTop: holiday && mobilization ? 68 : hasTopLabel ? 48 : 28,
                  }}
                >
                  {dayActions.slice(0, MAX_VISIBLE).map((a) => (
                    <MiniCard
                      key={a.id}
                      action={a}
                      color={getColor(a)}
                      selected={selectedId === a.id}
                      onSelect={onSelect}
                      draggable
                    />
                  ))}

                  {overflow > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          style={{ height: `${PLUS_MORE_HEIGHT}px` }}
                          className="w-full shrink-0 rounded bg-muted/50 px-2 text-[11px] font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground"
                        >
                          +{overflow} mais
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1" align="start">
                        <div className="flex flex-col gap-0.5">
                          {dayActions.slice(MAX_VISIBLE).map((a) => {
                            const t = a.dueDate || a.startDate;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => onSelect(a)}
                                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition hover:bg-muted"
                              >
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: getColor(a) }}
                                />
                                <span className="truncate font-medium">
                                  {a.isDone ? "✓ " : ""}
                                  {a.title}
                                </span>
                                {t && (
                                  <span className="ml-auto shrink-0 text-muted-foreground">
                                    {dayjs(t).format("HH:mm")}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>

    {/* DragOverlay — fantasma do card durante o drag */}
    <DragOverlay>
      {draggingAction ? (
        <div className="pointer-events-none">
          <MiniCard
            action={draggingAction}
            color={getColor(draggingAction)}
            selected={false}
            onSelect={() => {}}
          />
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}
