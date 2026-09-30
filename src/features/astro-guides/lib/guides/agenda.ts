import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const AGENDA_GUIDES: GuideDef[] = [
  {
    key: "agenda.share-link",
    app: "agenda",
    title: "Copiar o link de agendamento",
    summary: "Pegue o link público para o cliente marcar sozinho.",
    topicPattern:
      /\b(compartilh\w*|copi\w*|envi\w*|mand\w*|divulg\w*|peg\w*)\b.*\b(link|url|endereco)\b.*\b(agendas?|agendamentos?)\b|\blink (de|da|do) (agenda|agendamento)\b/,
    spaceHelp: { categorySlug: "spacetime", featureSlug: "compartilhar-link-agendamento" },
    steps: [
      {
        anchor: "agendaShowListButton",
        route: "/agendas",
        skipWhenVisible: "agendaNewButton",
        title: "Abra a lista de agendas",
        message: "A lista começa recolhida. Clique para mostrar.",
        position: "right",
        advanceOn: "click",
      },
      {
        anchor: "agendaCopyLinkButton",
        title: "Clique em Copiar link",
        message: "O link abre a página pública da agenda, onde o cliente escolhe dia e horário.",
        position: "right",
        advanceOn: "click",
        missingMessage: "Você ainda não tem agenda. Me peça: \"como crio uma agenda?\"",
      },
    ],
    finish: {
      title: "Link copiado! 🔗",
      message: "Cole no WhatsApp, no Instagram ou no site. Cada horário marcado vira lead no tracking da agenda.",
    },
  },
  {
    key: "agenda.create",
    app: "agenda",
    title: "Criar uma agenda",
    summary: "Monte a agenda onde os clientes marcam horário.",
    topicPattern: /\b(cri\w*|mont\w*|cadastr\w*|novas?|fac\w*|configur\w*)\b.*\b(agendas?|agendamentos?|calendarios?)\b/,
    spaceHelp: { categorySlug: "spacetime", featureSlug: "criar-agenda" },
    steps: [
      {
        anchor: "agendaShowListButton",
        route: "/agendas",
        skipWhenVisible: "agendaNewButton",
        title: "Abra a lista de agendas",
        message: "A lista começa recolhida. Clique para mostrar.",
        position: "right",
        advanceOn: "click",
      },
      {
        anchor: "agendaNewButton",
        title: "Clique em Nova",
        message: "Cada agenda tem o seu link, a sua duração e o tracking onde os agendamentos entram.",
        position: "right",
        advanceOn: "click",
      },
      {
        anchor: "agendaCreateTitle",
        title: "Dê um nome à agenda",
        message: "Ex.: \"Consulta inicial\". O link é preenchido sozinho a partir do nome.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "agendaCreateTracking",
        title: "Escolha o tracking",
        message: "Quem marcar horário vira lead nesse tracking. Escolha e clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "agendaCreateSubmit",
        title: "Clique em Continuar",
        message: "Assim que a agenda for criada, eu te mando para ela.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.agendaCreated,
      },
    ],
    finish: {
      title: "Agenda criada! 📅",
      message: "Agora configure os horários de atendimento dentro dela.",
      resultLabel: "Abrir agenda",
    },
  },
];
