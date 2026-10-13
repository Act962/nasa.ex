// Monta, no banco de desenvolvimento, o fluxo de teste da spec 0099: aceite → cadastro pela conversa.
// Cria um formulário de cadastro, um fluxo ligado e, opcionalmente, os níveis nas agendas do funil.
//   NEXT_PUBLIC_WORKFLOW_FORM_CHAT=true pnpm tsx --conditions=react-server scripts/setup-clinic-registration-flow.ts <organizationId> <trackingId> <userId> [--levels] [--start <leadId>] [--undo]
import "./astro-qa/load-env";
import { createId } from "@paralleldrive/cuid2";
import prisma from "../src/lib/prisma";
import { applyTagsByAi } from "../src/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { createWorkflowFromBlueprint, type Blueprint } from "../src/features/workflows/lib/agent-presets/create-from-blueprint";
import { findOrCreateTags } from "../src/features/workflows/lib/agent-presets/find-or-create-tags";
import { CONSENT_OUTPUTS, DEFAULT_CONSENT_PAYLOAD, DEFAULT_FORM_CHAT_PAYLOAD, FORM_CHAT_OUTPUTS } from "../src/features/workflows/lib/conversation-steps";

const [organizationId, trackingId, userId, ...flags] = process.argv.slice(2);
const FORM_NAME = "Cadastro do paciente (teste 0099)";
const FLOW_NAME = "Teste 0099: aceite e cadastro pela conversa";
const START_TAG = { slug: "teste-cadastro-0099", name: "Teste: iniciar cadastro", color: "#0b7de3" };
const HEALTH_PLANS = ["Unimed", "Hapvida", "Humana Saúde", "Bradesco Saúde", "SulAmérica", "Amil", "Cassi", "Geap", "Ipmt", "Planserv", "Postal Saúde", "Particular"];

const formBlocks = [
  {
    id: "layout-cadastro",
    blockType: "RowLayout",
    attributes: {},
    childblocks: [
      { id: "campo-cpf", blockType: "MaskedField", attributes: { label: "CPF", required: true, format: "cpf", fieldKey: "cpf", isSearchable: true, showInList: true } },
      { id: "campo-nome", blockType: "TextField", attributes: { label: "Nome completo", required: true, prefillFromLead: "name", useAsResponseLabel: true } },
      { id: "campo-genero", blockType: "RadioSelect", attributes: { label: "Gênero", required: true, allowMultiple: false, options: [{ value: "Masculino" }, { value: "Feminino" }, { value: "Outro" }] } },
      { id: "campo-nascimento", blockType: "DatePicker", attributes: { label: "Data de nascimento", required: true, withTime: false } },
      { id: "campo-convenio", blockType: "OrbitLookup", attributes: { label: "Convênio", required: true, source: "INLINE", inlineOptions: HEALTH_PLANS, fieldKey: "convenio", showInList: true } },
    ],
  },
];

const AGENDA_LEVELS: { nameIncludes: string; specialty: string; unit: string | null; professionalNotes: string | null }[] = [
  { nameIncludes: "Centro", specialty: "Consulta oftalmológica", unit: "Unidade Centro", professionalNotes: "Atende a partir de 8 anos. Consulta particular: R$ 400,00. (ficha de teste)" },
  { nameIncludes: "Jóckei", specialty: "Consulta oftalmológica", unit: "Unidade Jóckei", professionalNotes: null },
  { nameIncludes: "Exames", specialty: "Exames", unit: null, professionalNotes: null },
];

async function undo() {
  const flows = await prisma.workflow.deleteMany({ where: { trackingId, name: FLOW_NAME } });
  const forms = await prisma.form.findMany({ where: { organizationId, name: FORM_NAME }, select: { id: true } });
  for (const form of forms) {
    await prisma.formRecord.deleteMany({ where: { formId: form.id } });
    await prisma.formResponses.deleteMany({ where: { formId: form.id } });
    await prisma.form.delete({ where: { id: form.id } });
  }
  const agendas = await prisma.agenda.updateMany({ where: { trackingId }, data: { specialty: null, unit: null, professionalNotes: null } });
  console.log(`desfeito: ${flows.count} fluxo(s), ${forms.length} formulário(s), níveis limpos em ${agendas.count} agenda(s)`);
}

async function main() {
  if (flags.includes("--undo")) return undo();

  const tracking = await prisma.tracking.findFirstOrThrow({ where: { id: trackingId, organizationId }, select: { id: true } });
  const existingForm = await prisma.form.findFirst({ where: { organizationId, name: FORM_NAME }, select: { id: true } });
  const form =
    existingForm ??
    (await prisma.form.create({
      data: { userId, organizationId, name: FORM_NAME, description: "Formulário de teste da spec 0099.", jsonBlock: JSON.stringify(formBlocks), content: "", published: true, shareUrl: createId() },
      select: { id: true },
    }));
  console.log(`formulário: ${form.id} (${existingForm ? "já existia" : "criado"})`);

  const tagResult = await prisma.$transaction((tx) => findOrCreateTags(tx, organizationId, [START_TAG]));
  const startTagId = tagResult.tagMap[START_TAG.slug];

  const existingFlow = await prisma.workflow.findFirst({ where: { trackingId: tracking.id, name: FLOW_NAME }, select: { id: true } });
  if (existingFlow) {
    console.log(`fluxo: ${existingFlow.id} (já existia)`);
  } else {
    const text = (id: string, x: number, y: number, message: string) => ({ id, type: "SEND_MESSAGE", position: { x, y }, data: { action: { payload: { type: "TEXT", message } } } });
    const blueprint = {
      name: FLOW_NAME,
      description: "Recebeu a tag de teste: pede o aceite, cadastra pela conversa e avisa o resultado.",
      nodes: [
        { id: "gatilho", type: "LEAD_TAGGED", position: { x: 0, y: 0 }, data: { action: { tagIds: [startTagId], conditions: [] } } },
        { id: "aceite", type: "SEND_MESSAGE", position: { x: 360, y: 0 }, data: { action: { payload: { ...DEFAULT_CONSENT_PAYLOAD, policyUrl: "https://www.clinicaterciorezende.com.br/politica-de-privacidade/", askOnce: false } } } },
        {
          id: "cadastro",
          type: "SEND_MESSAGE",
          position: { x: 760, y: -120 },
          data: {
            action: {
              payload: {
                ...DEFAULT_FORM_CHAT_PAYLOAD,
                formId: form.id,
                fieldIds: ["campo-cpf", "campo-nome", "campo-genero", "campo-nascimento", "campo-convenio"],
                askOnlyMissing: false,
                fallbackOptionByField: { "campo-convenio": "Particular" },
              },
            },
          },
        },
        text("recusou", 760, 220, "Tudo bem. Sem o aceite não seguimos com o cadastro. Se mudar de ideia, é só chamar."),
        text("concluido", 1180, -260, "Cadastro concluído ✅ Agora você já pode agendar pelo menu."),
        text("desistiu", 1180, -100, "Sem problemas. Quando quiser continuar o cadastro, é só chamar."),
        text("atendente", 1180, 60, "Certo, vou avisar a nossa equipe para continuar com você."),
      ],
      edges: [
        { fromNodeId: "gatilho", toNodeId: "aceite", fromOutput: "main", toInput: "main" },
        { fromNodeId: "aceite", toNodeId: "cadastro", fromOutput: CONSENT_OUTPUTS.accepted, toInput: "main" },
        { fromNodeId: "aceite", toNodeId: "recusou", fromOutput: CONSENT_OUTPUTS.refused, toInput: "main" },
        { fromNodeId: "cadastro", toNodeId: "concluido", fromOutput: FORM_CHAT_OUTPUTS.done, toInput: "main" },
        { fromNodeId: "cadastro", toNodeId: "desistiu", fromOutput: FORM_CHAT_OUTPUTS.gaveUp, toInput: "main" },
        { fromNodeId: "cadastro", toNodeId: "atendente", fromOutput: FORM_CHAT_OUTPUTS.human, toInput: "main" },
      ],
    };
    const created = await prisma.$transaction((tx) =>
      createWorkflowFromBlueprint(tx, { trackingId: tracking.id, userId, blueprint: blueprint as unknown as Blueprint, agentMode: true, isActive: true, maxRunsPerHour: 60 }),
    );
    console.log(`fluxo: ${created.workflowId} (criado e ligado)`);
  }

  if (flags.includes("--levels")) {
    const agendas = await prisma.agenda.findMany({ where: { trackingId: tracking.id }, select: { id: true, name: true } });
    for (const agenda of agendas) {
      const level = AGENDA_LEVELS.find((candidate) => agenda.name.includes(candidate.nameIncludes));
      if (!level) continue;
      await prisma.agenda.update({ where: { id: agenda.id }, data: { specialty: level.specialty, unit: level.unit, professionalNotes: level.professionalNotes } });
      console.log(`agenda "${agenda.name}": ${level.specialty}${level.unit ? ` · ${level.unit}` : ""}`);
    }
  }

  const startIndex = flags.indexOf("--start");
  if (startIndex >= 0 && flags[startIndex + 1]) {
    const leadId = flags[startIndex + 1];
    await prisma.leadTag.deleteMany({ where: { leadId, tagId: startTagId } });
    const applied = await applyTagsByAi({ leadId, tagIds: [startTagId] });
    console.log(`tag de início aplicada ao lead ${leadId}: ${applied.added}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
