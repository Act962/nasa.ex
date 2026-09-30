import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const NBOX_GUIDES: GuideDef[] = [
  {
    key: "nbox.create-folder",
    app: "nbox",
    title: "Criar uma pasta no N-Box",
    summary: "Organize os arquivos da empresa em pastas.",
    topicPattern: /\b(cri\w*|fac\w*|faz\w*|novas?|adicion\w*)\b.*\b(pastas?|diretorios?)\b/,
    steps: [
      {
        anchor: "nboxNewFolderButton",
        route: "/nbox",
        title: "Clique em Pasta",
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
        message: "Ou clique para escolher no computador. Até 50 MB por arquivo.",
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
