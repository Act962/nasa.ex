import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const CAMPANHAS_GUIDES: GuideDef[] = [
  {
    key: "whatsapp-oficial.connect-number",
    app: "campanhas",
    title: "Conectar um número na API oficial do WhatsApp",
    summary: "Traga seu número ou compre um, conecte à Meta e cadastre o cartão.",
    topicPattern:
      /\b(api|conta|numeros?|whats\w*)\b.*\b(oficia\w*|meta|cloud|business)\b|\b(oficia\w*|meta)\b.*\b(whats\w*|numeros?)\b/,
    steps: [
      {
        anchor: "officialNumberBanner",
        route: "/campanhas",
        skipWhenVisible: "officialNumberWizard",
        title: "Comece por aqui",
        message:
          "Escolha o funil (tracking) onde as respostas vão chegar e clique em \"Conectar número oficial\" — ou em \"Começar\", se ainda não tiver funil.",
        position: "bottom",
        advanceOn: "next",
        missingMessage:
          "Esta empresa já tem número oficial. O painel do número, em Campanhas, mostra o status da conexão e o que falta.",
      },
      {
        anchor: "officialNumberWizard",
        title: "Siga o assistente",
        message:
          "Você traz o seu número ou compra um aqui, conecta à Meta e cadastra o cartão. Cada tela mostra onde clicar; dá para pausar e voltar depois.",
        position: "left",
        advanceOn: "next",
        padding: 4,
        missingMessage: "O assistente não abriu. Volte um passo e clique em \"Conectar número oficial\".",
      },
    ],
    finish: {
      title: "No caminho certo! ✅",
      message:
        "Quando a Meta aprovar, o número aparece no painel de Campanhas e passa a servir para disparos e para o Chat.",
    },
  },
  {
    key: "campanhas.create",
    app: "campanhas",
    title: "Criar um disparo em massa",
    summary: "Crie a campanha; depois escolha o modelo e os destinatários.",
    topicPattern:
      /\b(cri\w*|mont\w*|fac\w*|faz\w*|dispar\w*|envi\w*|mand\w*|novas?)\b.*\b(campanhas?|disparos?|em massa|broadcasts?|lista de transmissao)\b|\bdisparo em massa\b/,
    steps: [
      {
        anchor: "campaignNewButton",
        route: "/campanhas",
        title: "Clique em Nova campanha",
        message: "O disparo sai pelo número oficial do WhatsApp da empresa.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "campaignName",
        title: "Dê um nome à campanha",
        message: "Só a equipe vê. Ex.: \"Promoção de Outubro\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
        missingMessage:
          "Campanha só sai por número oficial do WhatsApp, e ainda não há um conectado. Clique em Encerrar e depois em \"Conectar meu WhatsApp\", na janela da campanha.",
      },
      {
        anchor: "campaignSendingNumber",
        title: "Escolha o número de origem",
        message: "É o número oficial que vai enviar as mensagens.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "campaignCreateSubmit",
        title: "Clique em Criar campanha",
        message: "Ela nasce como rascunho — nada é enviado ainda.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.broadcastCreated,
      },
    ],
    finish: {
      title: "Campanha criada! 📣",
      message:
        "Agora, na própria campanha: escolha o modelo aprovado na aba Modelo e os destinatários em Contatos. Depois é só agendar ou disparar.",
    },
  },
];
