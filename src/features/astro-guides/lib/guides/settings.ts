import type { GuideDef } from "../types";
import { GUIDE_RESULT_KINDS } from "../result-kinds";

export const SETTINGS_GUIDES: GuideDef[] = [
  {
    key: "settings.invite-member",
    app: "settings",
    title: "Convidar alguém para a equipe",
    summary: "Mande o convite por e-mail para um novo membro.",
    topicPattern:
      /\b(convid\w*|adicion\w*|coloc\w*|cham\w*|cadastr\w*|inclu\w*|cri\w*)\b.*\b(membros?|usuarios?|pessoas?|funcionarios?|colaborador\w*|equipe|time|vendedor\w*|atendente\w*|acessos?)\b/,
    steps: [
      {
        anchor: "memberAddButton",
        route: "/settings/members",
        title: "Clique em Adicionar Membro",
        message: "A pessoa recebe um convite por e-mail e entra como membro.",
        position: "bottom",
        advanceOn: "click",
        missingMessage:
          "Só o dono da empresa ou um moderador pode convidar pessoas. Peça a um deles para te mandar o convite.",
      },
      {
        anchor: "memberInviteEmail",
        title: "Digite o e-mail da pessoa",
        message: "É para esse e-mail que o convite vai. Depois clique em Continuar.",
        position: "left",
        advanceOn: "input",
      },
      {
        anchor: "memberInviteSubmit",
        title: "Clique em Adicionar",
        message: "O convite sai na hora.",
        position: "top",
        advanceOn: "result",
        resultKind: GUIDE_RESULT_KINDS.memberInvited,
      },
    ],
    finish: {
      title: "Convite enviado! ✉️",
      message:
        "Quando a pessoa aceitar, ela aparece em Membros. Para mudar o que ela pode ver, use a aba Permissões nas configurações.",
    },
  },
];
