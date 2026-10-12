// Confere as regras dos passos de conversa (spec 0099) sem banco e sem enviar nada.
// Rodar: NEXT_PUBLIC_WORKFLOW_FORM_CHAT=true pnpm tsx scripts/verify-conversation-steps.ts
import {
  CONSENT_OUTPUTS,
  DEFAULT_CONSENT_PAYLOAD,
  DEFAULT_FORM_CHAT_PAYLOAD,
  FORM_CHAT_OUTPUTS,
  conversationStepOutputs,
  interruptOf,
  readAwaitingStepReply,
  replyTimeoutMinutesOf,
  stepReplyId,
  stepReplyKey,
} from "../src/features/workflows/lib/conversation-steps";
import { listChatFields, optionButtonsFor, questionFor, readAnswer, summaryOf } from "../src/features/workflows/lib/form-chat";
import { clientMenuId, parseClientMenuId } from "../src/features/tracking-chat-ai/lib/guided-menu/menu-ids";

let failures = 0;
function check(label: string, isOk: boolean, detail = "") {
  if (!isOk) failures += 1;
  console.log(`${isOk ? "ok   " : "FALHA"} ${label}${detail ? ` · ${detail}` : ""}`);
}

const formBlocks = JSON.stringify([
  { id: "layout-1", blockType: "RowLayout", attributes: {}, childblocks: [
    { id: "titulo", blockType: "Heading", attributes: { label: "Cadastro" } },
    { id: "cpf", blockType: "MaskedField", attributes: { label: "CPF", required: true, format: "cpf", fieldKey: "cpf" } },
    { id: "nome", blockType: "TextField", attributes: { label: "Nome completo", required: true, prefillFromLead: "name" } },
    { id: "genero", blockType: "RadioSelect", attributes: { label: "Gênero", required: true, options: [{ value: "Masculino" }, { value: "Feminino" }, { value: "Outro" }] } },
    { id: "nascimento", blockType: "DatePicker", attributes: { label: "Data de nascimento", required: true } },
    { id: "convenio", blockType: "OrbitLookup", attributes: { label: "Convênio", required: true, source: "INLINE", inlineOptions: ["Unimed", "Hapvida", "Humana Saúde", "Particular"] } },
    { id: "obs", blockType: "TextArea", attributes: { label: "Observações", required: false } },
    { id: "assinatura", blockType: "SignatureClient", attributes: { label: "Assinatura" } },
    { id: "multi", blockType: "RadioSelect", attributes: { label: "Interesses", allowMultiple: true, options: [{ value: "A" }] } },
  ] },
]);

const fields = listChatFields(formBlocks);
const fieldOf = (fieldId: string) => fields.find((field) => field.id === fieldId)!;
check("só os campos que dá para perguntar entram, na ordem", fields.map((field) => field.id).join(",") === "cpf,nome,genero,nascimento,convenio,obs", fields.map((field) => field.id).join(","));
check("CPF espelha o documento do lead e o nome espelha o nome", fieldOf("cpf").leadSource === "document" && fieldOf("nome").leadSource === "name");

check("CA-2 CPF inválido é recusado com o formato", !readAnswer(fieldOf("cpf"), { text: "03262801345", optionKey: null }).isValid);
const validCpf = readAnswer(fieldOf("cpf"), { text: "529.982.247-25", optionKey: null });
check("CPF válido é aceito e guardado com máscara", validCpf.isValid && validCpf.value.value === "529.982.247-25", validCpf.isValid ? validCpf.value.value : "");
check("CB-8 CPF de dígitos repetidos é inválido", !readAnswer(fieldOf("cpf"), { text: "11111111111", optionKey: null }).isValid);

const byClick = readAnswer(fieldOf("genero"), { text: "", optionKey: "1" });
const byText = readAnswer(fieldOf("genero"), { text: "feminino", optionKey: null });
const byNumber = readAnswer(fieldOf("genero"), { text: "3", optionKey: null });
check("opção vale por clique, por nome e por número", byClick.isValid && byText.isValid && byNumber.isValid && byClick.display === "Feminino" && byNumber.display === "Outro");
check("texto fora das opções é recusado", !readAnswer(fieldOf("genero"), { text: "talvez", optionKey: null }).isValid);
check("campo de 3 opções vira 3 botões", optionButtonsFor(fieldOf("genero"))?.length === 3 && optionButtonsFor(fieldOf("nome")) === null);

const validDate = readAnswer(fieldOf("nascimento"), { text: "15/12/1987", optionKey: null });
check("data dd/mm/aaaa vira ISO", validDate.isValid && validDate.value.value === "1987-12-15" && validDate.display === "15/12/1987");
check("data impossível é recusada", !readAnswer(fieldOf("nascimento"), { text: "31/02/1990", optionKey: null }).isValid && !readAnswer(fieldOf("nascimento"), { text: "ontem", optionKey: null }).isValid);

const exactPlan = readAnswer(fieldOf("convenio"), { text: "unimed", optionKey: null });
const partialPlan = readAnswer(fieldOf("convenio"), { text: "humana", optionKey: null });
const unknownPlan = readAnswer(fieldOf("convenio"), { text: "Bradesco", optionKey: null });
check("convênio é achado sem acento e por pedaço", exactPlan.isValid && exactPlan.display === "Unimed" && partialPlan.isValid && partialPlan.display === "Humana Saúde");
check("CA-4 convênio fora da lista cai em 'não encontrei'", !unknownPlan.isValid && unknownPlan.reason === "not_in_list");

const skipped = readAnswer(fieldOf("obs"), { text: "Pular", optionKey: null });
check("campo opcional aceita 'pular'", skipped.isValid && skipped.value.value === "" && questionFor(fieldOf("obs")).includes("pular"));
check("campo obrigatório não oferece 'pular'", !questionFor(fieldOf("cpf")).includes("pular") && questionFor(fieldOf("cpf")).includes("11 números"));
check("CB-9 resposta longa é cortada em 500", (() => { const long = readAnswer(fieldOf("nome"), { text: "a".repeat(900), optionKey: null }); return long.isValid && long.value.value.length === 500; })());

const summary = summaryOf(fields.slice(0, 3), { cpf: { value: "529.982.247-25" }, nome: { value: "Maria" }, genero: undefined });
check("resumo lista os campos e marca o que falta", summary.includes("CPF: 529.982.247-25") && summary.includes("Gênero: não informado") && summary.endsWith("Está correto?"));

check("'falar com atendente' interrompe para a equipe", interruptOf("Falar com atendente") === "human" && interruptOf("atendente") === "human");
check("'menu' e 'cancelar' saem do passo", interruptOf("Menu") === "leave" && interruptOf("cancelar") === "leave");
check("resposta comum não interrompe", interruptOf("Maria Atendente da Silva") === null && interruptOf("03261801336") === null);

check("id de botão do passo vai e volta", stepReplyKey("n1", stepReplyId("n1", "yes")) === "yes");
check("clique de outro passo ou de outro menu não vale", stepReplyKey("n1", stepReplyId("n2", "yes")) === null && stepReplyKey("n1", "cli:menu") === null);

const now = new Date("2026-10-12T12:00:00Z");
check("espera vigente é reconhecida", readAwaitingStepReply({ awaitingStepReply: { nodeId: "n1", expiresAt: "2026-10-12T12:20:00Z" } }, now)?.nodeId === "n1");
check("espera vencida não segura a mensagem", readAwaitingStepReply({ awaitingStepReply: { nodeId: "n1", expiresAt: "2026-10-12T11:00:00Z" } }, now) === null && readAwaitingStepReply(null, now) === null);
check("prazo nunca passa de 24 h", replyTimeoutMinutesOf({ replyTimeoutMinutes: 99999 }) === 1440 && replyTimeoutMinutesOf({}) === 30);

const consentOutputs = conversationStepOutputs({ action: { payload: DEFAULT_CONSENT_PAYLOAD } });
const formOutputs = conversationStepOutputs({ action: { payload: DEFAULT_FORM_CHAT_PAYLOAD } });
check("aceite tem as saídas Aceitou e Recusou", consentOutputs?.map((output) => output.id).join(",") === `${CONSENT_OUTPUTS.accepted},${CONSENT_OUTPUTS.refused}`);
check("cadastro tem as saídas Concluído, Desistiu e Pediu atendente", formOutputs?.map((output) => output.id).join(",") === `${FORM_CHAT_OUTPUTS.done},${FORM_CHAT_OUTPUTS.gaveUp},${FORM_CHAT_OUTPUTS.human}`);
check("quadro comum não ganha saída extra", conversationStepOutputs({ action: { payload: { type: "TEXT", message: "oi" } } }) === null);
process.env.NEXT_PUBLIC_WORKFLOW_FORM_CHAT = "false";
check("opção desligada: nenhuma saída de passo de conversa", conversationStepOutputs({ action: { payload: DEFAULT_CONSENT_PAYLOAD } }) === null);

const specialtyId = clientMenuId({ step: "specialty", specialty: 2 });
const unitId = clientMenuId({ step: "unit", specialty: -1, unit: 1 });
const parsedUnit = parseClientMenuId(unitId);
check("toque de especialidade e de unidade vai e volta", JSON.stringify(parseClientMenuId(specialtyId)) === JSON.stringify({ step: "specialty", specialty: 2 }) && parsedUnit?.step === "unit" && parsedUnit.specialty === -1 && parsedUnit.unit === 1);
check("posição fora do limite é recusada", parseClientMenuId("cli:specialty|999") === null && parseClientMenuId("cli:unit|a|b") === null);

console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
process.exit(failures === 0 ? 0 : 1);
