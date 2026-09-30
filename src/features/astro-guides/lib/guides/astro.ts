import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const ASTRO_APP_GUIDES: GuideDef[] = [
  {
    key: "astro-chat.install-site",
    app: "astro",
    title: "Colocar o Astro no meu site",
    summary: "Cadastre o site e copie o código do widget.",
    topicPattern:
      /\b(coloc\w*|instal\w*|adicion\w*|cri\w*|ativ\w*|configur\w*)\b.*\b(astro chat|widget|chat no (meu )?site|atendente no site|astro no (meu )?site)\b/,
    steps: [
      {
        anchor: "astroChatAddSite",
        route: "/astro-chat",
        title: "Clique em Adicionar site",
        message: "O Astro atende no seu site e cada conversa chega no Chat. Cobra uma mensalidade em Stars por site.",
        position: "bottom",
        advanceOn: "click",
        missingMessage: "Só o dono ou um administrador pode adicionar sites ao Astro Chat.",
      },
      {
        anchor: "astroChatSiteDialog",
        title: "Preencha e crie",
        message:
          "Nome, o domínio do site (com https://, aperte Enter para adicionar) e o tracking que recebe os leads. Depois clique em Criar e ativar.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.astroChatSiteCreated,
        padding: 4,
      },
    ],
    finish: {
      title: "Site cadastrado! 🤖",
      message: "Na aba Instalação, copie o código e cole no <head> do seu site. O widget aparece na próxima visita.",
    },
  },
  {
    key: "astro.permissions",
    app: "astro",
    title: "Configurar o que o Astro pode fazer",
    summary: "Ligue os agentes e escolha se eles pedem confirmação.",
    topicPattern:
      /\b(configur\w*|permiss\w*|lig\w*|deslig\w*|ativ\w*|desativ\w*|limit\w*)\b.*\b(astro|agentes?|ia)\b/,
    steps: [
      {
        anchor: "astroAgentsPanel",
        route: "/astro?aba=permissoes",
        title: "Agentes do Astro",
        message:
          "Cada agente tem uma chave para ligar e um modo: Manual (pede sua confirmação), Gatilho ou Automático. Só dono e administradores alteram.",
        position: "top",
        advanceOn: "next",
        padding: 4,
      },
    ],
    finish: {
      title: "Tudo sob controle! 🛡️",
      message: "As mudanças valem na hora para toda a empresa.",
    },
  },
];
