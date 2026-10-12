// Confere as regras do menu que espera o clique (spec 0090, seção F). Rodar: pnpm tsx scripts/verify-button-reply-flow.ts
import assert from "node:assert/strict";
import { NO_CLICK_OUTPUT, buttonReplyOutputs, chooseButtonReplyOutput } from "../src/features/workflows/lib/button-reply-flow";
import { getNodeOutputs } from "../src/features/tracking-executions/lib/node-options";
import { diagnoseFlow } from "../src/features/workflows/lib/flow-diagnostics";

const menu = (extra: Record<string, unknown> = {}) => ({
  action: {
    payload: {
      type: "BUTTONS",
      mode: "inline",
      bodyText: "Quer agendar?",
      buttons: [{ id: "sim", text: "Sim" }, { id: "nao", text: "Não" }],
      ...extra,
    },
  },
});
let checks = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  assert.deepEqual(actual, expected, label);
  checks += 1;
  console.log(`ok    ${label}`);
};

delete process.env.NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE;
check("interruptor desligado: o menu continua com uma saída só", getNodeOutputs("SEND_MESSAGE", menu({ waitForReply: true })), ["main"]);
check("interruptor desligado: sem saídas por botão", buttonReplyOutputs(menu({ waitForReply: true })), null);

process.env.NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE = "true";
check("ligado mas sem marcar no quadro: uma saída só", getNodeOutputs("SEND_MESSAGE", menu()), ["main"]);
check("ligado e marcado: uma saída por botão e sem clique", getNodeOutputs("SEND_MESSAGE", menu({ waitForReply: true })), ["btn:sim", "btn:nao", NO_CLICK_OUTPUT]);
check("menu salvo (preset) fica com uma saída só", getNodeOutputs("SEND_MESSAGE", menu({ waitForReply: true, mode: "preset" })), ["main"]);
check("mensagem de texto não muda", getNodeOutputs("SEND_MESSAGE", { action: { payload: { type: "TEXT", message: "oi" } } }), ["main"]);

const sentButtonIds = ["sim", "nao"];
check("clique num botão enviado segue a saída dele", chooseButtonReplyOutput({ sentButtonIds, hasTimedOut: false, clickedButtonId: "nao" }), "btn:nao");
check("prazo vencido vai para sem clique, mesmo com clique antigo guardado", chooseButtonReplyOutput({ sentButtonIds, hasTimedOut: true, clickedButtonId: "sim" }), NO_CLICK_OUTPUT);
check("texto livre (sem id de clique) vai para sem clique", chooseButtonReplyOutput({ sentButtonIds, hasTimedOut: false, clickedButtonId: undefined }), NO_CLICK_OUTPUT);
check("segurança: id que este quadro não enviou não escolhe saída", chooseButtonReplyOutput({ sentButtonIds, hasTimedOut: false, clickedButtonId: "admin" }), NO_CLICK_OUTPUT);

const trigger = { id: "t", type: "MESSAGE_INCOMING", data: {} };
const edges = [{ id: "e", source: "t", target: "m" }];
const codes = (data: unknown, canSendOfficialMenu: boolean) =>
  diagnoseFlow([trigger, { id: "m", type: "SEND_MESSAGE", data }], edges, { provider: "meta", canSendOfficialMenu }).map((diagnostic) => diagnostic.code);
check("API oficial com o interruptor desligado: menu continua barrado", codes(menu(), false), ["META_BUTTONS_BLOCKED"]);
check("API oficial com o interruptor ligado: menu de 2 botões passa", codes(menu(), true), []);
check("API oficial: 4 botões é erro", codes(menu({ buttons: ["a", "b", "c", "d"].map((id) => ({ id, text: id })) }), true), ["TOO_MANY_OPTIONS"]);
check("API oficial: título acima de 20 caracteres é erro", codes(menu({ buttons: [{ id: "x", text: "Quero falar com um atendente" }] }), true), ["OPTION_TITLE_TOO_LONG"]);
console.log(`TUDO CERTO (${checks} verificações)`);
