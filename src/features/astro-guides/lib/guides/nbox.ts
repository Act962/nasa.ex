import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const NBOX_GUIDES: GuideDef[] = [
  {
    key: "nbox.request-files",
    app: "nbox",
    title: "Receber arquivos de um cliente por link",
    summary: "Gere um link para o cliente enviar arquivos direto numa pasta, sem criar conta.",
    topicPattern:
      /\b(receb\w*|ped\w*|pedir|solicit\w*|colet\w*)\b.*\b(arquivos?|fotos?|videos?|documentos?|cliente)\b/,
    steps: [
      {
        anchor: "nboxMoreActionsButton",
        route: "/nbox",
        title: "Abra o menu ao lado de Enviar",
        message: "Clique na seta: ali ficam Pedir arquivos, Transferir, Nova pasta e Guardar link.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "nboxRequestFilesButton",
        title: "Clique em Pedir arquivos",
        message: "Abre a janela para criar o link de envio.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "nboxRequestFilesCreateButton",
        title: "Dê um nome e crie o link",
        message: "Use o nome do cliente. Escolha por quantos dias o link aceita arquivos e clique em Criar link de envio.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.nboxUploadLinkCreated,
      },
    ],
    finish: {
      title: "Link de envio pronto! 📥",
      message: "Mande o link para o cliente. O que ele enviar aparece nesta pasta e você é avisado no sino.",
    },
  },
  {
    key: "nbox.transfer",
    app: "nbox",
    title: "Mandar arquivos pesados por link",
    summary: "Gere um link que o cliente baixa sem login e que se apaga sozinho depois do prazo.",
    topicPattern:
      /\b(transfer\w*|mand\w*|envi\w*|compartilh\w*)\b.*\b(arquivos? pesados?|videos?|link|cliente|wetransfer|transferencias?)\b/,
    steps: [
      {
        anchor: "nboxMoreActionsButton",
        route: "/nbox",
        title: "Abra o menu ao lado de Enviar",
        message: "Clique na seta: ali ficam Pedir arquivos, Transferir, Nova pasta e Guardar link.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "nboxTransfersButton",
        title: "Clique em Transferir",
        message: "Abre a janela para montar o link.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "nboxTransferDropzone",
        title: "Escolha os arquivos",
        message: "Arraste aqui ou clique para escolher. Até 5 GB cada. Escolha também por quantos dias o link vale.",
        position: "left",
        advanceOn: "click",
      },
      {
        anchor: "nboxTransferCreateButton",
        title: "Clique em Criar link",
        message: "Depois é só copiar o link e mandar para o cliente.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.nboxTransferCreated,
      },
    ],
    finish: {
      title: "Link pronto! 🔗",
      message: "Ele aparece em Transferências, onde dá para prorrogar ou encerrar.",
    },
  },
  {
    key: "nbox.create-folder",
    app: "nbox",
    title: "Criar uma pasta no N-Box",
    summary: "Organize os arquivos da empresa em pastas.",
    topicPattern: /\b(cri\w*|fac\w*|faz\w*|novas?|adicion\w*)\b.*\b(pastas?|diretorios?)\b/,
    steps: [
      {
        anchor: "nboxMoreActionsButton",
        route: "/nbox",
        title: "Abra o menu ao lado de Enviar",
        message: "Clique na seta: ali ficam Pedir arquivos, Transferir, Nova pasta e Guardar link.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "nboxNewFolderButton",
        title: "Clique em Nova pasta",
        message: "A pasta nasce dentro da pasta aberta no momento.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "nboxFolderName",
        title: "Dê um nome à pasta",
        message: "Ex.: \"Contratos\" ou \"Fotos de produto\". Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "nboxFolderSubmit",
        title: "Clique em Criar",
        message: "Dá para escolher uma cor antes, se quiser.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.nboxFolderCreated,
      },
    ],
    finish: {
      title: "Pasta criada! 📁",
      message: "Clique nela para abrir e enviar arquivos lá dentro.",
    },
  },
  {
    key: "nbox.upload",
    app: "nbox",
    title: "Enviar um arquivo para o N-Box",
    summary: "Guarde documentos e imagens da empresa num só lugar.",
    topicPattern:
      /\b(envi\w*|sub\w*|carreg\w*|guard\w*|salv\w*|upload\w*|adicion\w*|coloc\w*)\b.*\b(arquivos?|documentos?|fotos?|imagens?|pdfs?|nbox|n-box|n box)\b/,
    steps: [
      {
        anchor: "nboxUploadButton",
        route: "/nbox",
        title: "Clique em Enviar",
        message: "O arquivo vai para a pasta aberta no momento.",
        position: "bottom",
        advanceOn: "click",
      },
      {
        anchor: "nboxDropzone",
        title: "Arraste o arquivo aqui",
        message: "Ou clique para escolher no computador. Até 5 GB por arquivo.",
        position: "left",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.nboxFileUploaded,
      },
    ],
    finish: {
      title: "Arquivo enviado! 📤",
      message: "Ele já aparece na lista. Para compartilhar, use o menu do arquivo.",
    },
  },
];
