import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";

// Como cada campo é falado e quais opções ele oferece quando falta.

/** Rótulo falado do campo. Sem isso o Astro pediria "clientName" em voz alta. */
const FIELD_LABELS: Record<string, string> = {
  clientName: "o nome do cliente",
  proposalRef: "qual proposta (o número, como #14)",
  addProducts: "o que acrescentar na proposta",
  removeProducts: "o que remover da proposta",
  productName: "quais produtos entram na proposta",
  title: "o título",
  taskName: "qual demanda",
  itemTitle: "o item do checklist",
  newTitle: "o novo título",
  validUntil: "a validade",
  leadName: "o nome do lead",
  personName: "o nome da pessoa",
  formName: "o nome do formulário",
  trackingName: "o nome do tracking",
  workspaceName: "o nome do workspace",
  tagName: "o nome da tag",
  scope: "se a tag é para tracking (leads) ou workspace (tarefas)",
  agendaName: "o nome da agenda",
  accountName: "o nome da conta",
  amount: "o valor",
  description: "a descrição do lançamento",
  type: "se é despesa ou receita",
  dueDate: "o vencimento",
  statusName: "o nome da coluna",
  currentName: "o nome atual da coluna",
  newName: "o novo nome",
  startsAt: "o novo horário",
  remindTime: "o horário",
  recurrence: "a frequência",
  message: "a mensagem",
  note: "o que anotar",
  date: "o dia",
  phone: "o telefone",
  templateName: "o nome do template",
  published: "se é para publicar ou tirar do ar",
  favorite: "se é para favoritar ou desfavoritar",
  active: "se é para ativar ou desativar",
  blocked: "se é para bloquear ou liberar",
  siteUrl: "o site",
};

export function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/**
 * Opções para o campo que faltou. Perguntar "me diga: o nome do tracking"
 * obriga o usuário a lembrar e digitar o que o sistema já sabe — quando a
 * lista é curta, a escolha responde em um toque.
 */
export async function optionsForField(
  ctx: AgentContext,
  field: string,
): Promise<{ id: string; label: string }[] | null> {
  const MAX_OPTIONS = 8;
  const where = { organizationId: ctx.organizationId };

  if (field === "trackingName") {
    const rows = await prisma.tracking.findMany({
      where,
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  if (field === "agendaName") {
    const rows = await prisma.agenda.findMany({
      where,
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  // Produtos do Forge, os mais usados em propostas primeiro (spec 0032, RF-1).
  if (field === "productName" || field === "addProducts") {
    const rows = await prisma.forgeProduct.findMany({
      where,
      select: { id: true, name: true, _count: { select: { proposalProducts: true } } },
      orderBy: [{ proposalProducts: { _count: "desc" } }, { name: "asc" }],
      take: MAX_OPTIONS,
    });
    if (rows.length === 0) return null;
    const options = rows.map((row) => ({ id: row.id, label: row.name }));
    // Proposta sem item é escolha legítima: sem esta saída, quem não quer
    // produto nenhum fica preso na pergunta.
    if (field === "productName") {
      options.push({ id: "__none__", label: "Nenhum por enquanto" });
    }
    return options;
  }

  if (field === "validUntil") {
    return [
      { id: "7", label: "7 dias" },
      { id: "15", label: "15 dias" },
      { id: "30", label: "30 dias" },
      { id: "0", label: "Sem validade" },
    ];
  }

  if (field === "formName") {
    const rows = await prisma.form.findMany({
      where,
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  if (field === "workspaceName") {
    const rows = await prisma.workspace.findMany({
      where: { ...where, isArchived: false },
      select: { id: true, name: true },
      take: MAX_OPTIONS,
    });
    return rows.length > 0 ? rows.map((row) => ({ id: row.id, label: row.name })) : null;
  }

  return null;
}

