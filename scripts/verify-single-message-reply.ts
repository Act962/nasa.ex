// Confere a opção "Responder em uma mensagem só" do atendimento (spec 0084, ajuste de 2026-10-11).
// Puro: sem banco e sem IA.
import { parseAiCapabilities } from "../src/features/tracking-chat-ai/lib/capabilities";
import { joinAsSingleMessage, splitForWhatsapp } from "../src/features/tracking-chat-ai/lib/split-message";

let failureCount = 0;
function check(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const threeBlocks = "Atendemos Unimed, sim.\n\nA avaliação pode ser feita pelo convênio.\n\nQuer que eu veja um horário?";
check("desligada (padrão): a resposta continua saindo em várias mensagens", splitForWhatsapp(threeBlocks).length === 3);
check("opção ausente ou valor antigo = desligada", parseAiCapabilities({}).singleMessageReply === false && parseAiCapabilities(null).singleMessageReply === false);
const single = joinAsSingleMessage(threeBlocks);
check("ligada: a mesma resposta sai numa mensagem só", single.length === 1, String(single.length));
check("ligada: sem linha em branco no meio", !/\n\n/.test(single[0]) && single[0].includes("Unimed") && single[0].includes("horário?"));
const slots = "Tenho estes horários na quarta:\n09:00\n10:00\n11:00";
check("lista de horários continua em linhas, numa mensagem", joinAsSingleMessage(slots).length === 1 && joinAsSingleMessage(slots)[0].split("\n").length === 4);
const long = Array.from({ length: 40 }, (_, index) => `Esta é a frase número ${index + 1} de uma resposta longa demais.`).join(" ");
const cut = joinAsSingleMessage(long);
check("resposta longa demais é cortada no fim de uma frase", cut.length === 1 && cut[0].length <= 700 && cut[0].endsWith("."), `${cut[0].length} caracteres`);
check("resposta vazia não envia nada", joinAsSingleMessage("  \n ").length === 0);

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
