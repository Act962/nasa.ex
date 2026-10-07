/**
 * Critérios de aceite da spec 0072 — as frases da conversa real que motivou a
 * correção, conferidas em código (sem modelo e sem gravar nada).
 *
 *   pnpm tsx --require ./scripts/_setup-server-only.cjs scripts/verify-astro-whatsapp-intent.ts
 */
import "dotenv/config";
import { createWorkspaceActionItem } from "../src/features/astro/actions/workspace/create-action";
import { createPaymentEntryAction } from "../src/features/astro/actions/payment/create-entry";
import { updateWorkspaceActionItem } from "../src/features/astro/actions/workspace/update-action";
import { addChecklistItemAction } from "../src/features/astro/actions/workspace/add-checklist-item";
import { looksLikeNewRequest } from "../src/features/astro/actions/guided-answers";
import { matchIntentPattern, matchesAnyIntentPattern } from "../src/features/astro/actions/match-intent-pattern";
import { parseCalendarDate } from "../src/features/astro/actions/parse-when";

let failures = 0;

function check(id: string, passed: boolean, detail: string): void {
  console.log(`[${passed ? "PASS" : "FAIL"}] ${id} — ${detail}`);
  if (!passed) failures += 1;
}

const TASK_PHRASE =
  'Criar uma demanda com o título "Cobrar STARs no Planner, criação, publicação e programação" para hoje às 18h, com os participantes Suellen e João';
const taskFields = createWorkspaceActionItem.inferFields!(TASK_PHRASE);

check(
  "CA-1 título entre aspas inteiro",
  taskFields.title === "Cobrar STARs no Planner, criação, publicação e programação",
  String(taskFields.title),
);
check("CA-2 prazo com hora", taskFields.dueAnswer === "hoje às 18h", String(taskFields.dueAnswer));
const dueIso = parseCalendarDate(String(taskFields.dueAnswer));
const dueHour = dueIso
  ? new Date(dueIso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
  : null;
check("CA-2 prazo vira 18:00 de Brasília", dueHour === "18:00", String(dueHour));
check("CA-3 participantes lidos", taskFields.participantNames === "Suellen e João", String(taskFields.participantNames));

const looseFields = createWorkspaceActionItem.inferFields!(
  "cria a tarefa revisar contrato no workspace Operação para amanhã, urgente",
);
check(
  "CA-1 título sem aspas segue igual",
  looseFields.title === "revisar contrato" && looseFields.workspaceName === "Operação" && looseFields.dueAnswer === "amanhã",
  JSON.stringify(looseFields),
);
const namedFields = createWorkspaceActionItem.inferFields!("criar demanda com o título Fechar caixa para sexta");
check("CA-1 'com o título' sai do título", namedFields.title === "Fechar caixa", String(namedFields.title));

function routedAction(phrase: string): string | undefined {
  return matchIntentPattern(phrase)?.candidates[0]?.action;
}

const CHECKLIST_PHRASE = "Preciso adicionar um item no checklist de um workspace";
check("CA-4 checklist cai no verbo de checklist", routedAction(CHECKLIST_PHRASE) === "action.add_checklist_item", String(routedAction(CHECKLIST_PHRASE)));
const vagueChecklist = addChecklistItemAction.inferFields!(CHECKLIST_PHRASE);
check(
  "CA-4 frase vaga não inventa item nem demanda",
  vagueChecklist.itemTitle === undefined && vagueChecklist.taskName === undefined,
  JSON.stringify(vagueChecklist),
);
const fullChecklist = addChecklistItemAction.inferFields!('adiciona o item "Revisar orçamento" no checklist da demanda Criar site');
check(
  "CA-4 item e demanda saem da frase",
  fullChecklist.itemTitle === "Revisar orçamento" && fullChecklist.taskName === "Criar site",
  JSON.stringify(fullChecklist),
);
check(
  "CA-4 subtarefa sem aspas",
  addChecklistItemAction.inferFields!("nova subtarefa ligar para o cliente na demanda Fechar caixa").itemTitle === "ligar para o cliente",
  JSON.stringify(addChecklistItemAction.inferFields!("nova subtarefa ligar para o cliente na demanda Fechar caixa")),
);

const EDIT_PHRASE = "Quero editar essa última demanda que criei";
check("CA-5 editar cai no verbo de editar", routedAction(EDIT_PHRASE) === "action.update", String(routedAction(EDIT_PHRASE)));
check("CA-5 'última que criei' é entendida", updateWorkspaceActionItem.inferFields!(EDIT_PHRASE).taskName === "última", JSON.stringify(updateWorkspaceActionItem.inferFields!(EDIT_PHRASE)));
const dueChange = updateWorkspaceActionItem.inferFields!("muda o prazo da demanda Criar site para sexta às 10h");
check(
  "CA-5 demanda e prazo novo saem da frase",
  dueChange.taskName === "Criar site" && dueChange.dueAnswer === "sexta às 10h" && dueChange.newTitle === undefined,
  JSON.stringify(dueChange),
);
const priorityChange = updateWorkspaceActionItem.inferFields!("altera a prioridade da demanda Criar site para alta");
check("CA-5 prioridade nova sai da frase", priorityChange.priorityName === "alta" && priorityChange.taskName === "Criar site", JSON.stringify(priorityChange));
check("CA-5 criar demanda continua criando", routedAction("Criar uma demanda revisar contrato") === "action.create", String(routedAction("Criar uma demanda revisar contrato")));
check("CA-5 editar lead não é desviado", routedAction("muda o telefone do João para 86 99999-0000") === "lead.update", String(routedAction("muda o telefone do João para 86 99999-0000")));

const workspaceOptions = [{ label: "Time de Tecnologia" }, { label: "DEMANDAS ÓRBITA" }, { label: "REUNIÕES" }];
check(
  "CA-6 'Editar tarefa' numa lista é assunto novo",
  looksLikeNewRequest("Editar tarefa", workspaceOptions),
  "sai do ciclo em vez de virar nome de workspace",
);
check("CA-6 '3' numa lista é resposta", !looksLikeNewRequest("3", workspaceOptions), "continua o ciclo");
check(
  "CA-6 'manda no Nubank' cita a opção",
  !looksLikeNewRequest("manda no Nubank", [{ label: "Nu bank - 526337699-7" }, { label: "Caixa" }]),
  "continua o ciclo",
);

const ENTRY_PHRASE = "200,00 em despesa de combustível";
const entryFields = createPaymentEntryAction.inferFields!(ENTRY_PHRASE);
check("CA-7 frase com valor é lançamento", matchesAnyIntentPattern(ENTRY_PHRASE), "consulta não responde");
check(
  "CA-7 cai no verbo de lançar",
  matchIntentPattern(ENTRY_PHRASE)?.candidates[0]?.action === "payment.create_entry",
  String(matchIntentPattern(ENTRY_PHRASE)?.candidates[0]?.action),
);
check(
  "CA-7 tipo, valor e descrição saem da frase",
  entryFields.type === "PAYABLE" && entryFields.amount === 200 && entryFields.description === "combustível",
  JSON.stringify(entryFields),
);
const classicFields = createPaymentEntryAction.inferFields!("lança uma despesa de R$ 150,00 de internet vencendo dia 10");
check(
  "CA-7 frase antiga segue igual",
  classicFields.amount === 150 && classicFields.description === "internet" && classicFields.dueDate === "dia 10",
  JSON.stringify(classicFields),
);
check(
  "CA-7 pergunta de gasto continua consulta",
  !matchesAnyIntentPattern("quanto gastei com combustível esse mês?"),
  "não vira lançamento",
);

console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
process.exit(failures === 0 ? 0 : 1);
