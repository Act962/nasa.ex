import dayjs from "dayjs";
import { ActionDetail } from "../schemas";

interface Ctx {
  action: ActionDetail;
  workspace: { name: string };
  column?: { name: string };
  participant?: { name: string; email: string };
}

export function renderWorkspaceVariables(template: string, ctx: Ctx) {
  const vars: Record<string, string> = {
    "{{action.title}}": ctx.action.title,
    "{{action.priority}}": ctx.action.priority,
    "{{action.dueDate}}": ctx.action.dueDate
      ? dayjs(ctx.action.dueDate).format("DD/MM/YYYY")
      : "",
    "{{action.column}}": ctx.column?.name ?? "",
    "{{workspace.name}}": ctx.workspace.name,
    "{{participant.name}}": ctx.participant?.name ?? "",
    "{{participant.email}}": ctx.participant?.email ?? "",
  };
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(k, v);
  }
  return out;
}

export const workspaceVariables = {
  "{{action.title}}": "Título da ação",
  "{{action.priority}}": "Prioridade da ação",
  "{{action.dueDate}}": "Data de vencimento",
  "{{action.column}}": "Nome da coluna",
  "{{workspace.name}}": "Nome do workspace",
  "{{participant.name}}": "Nome do participante",
  "{{participant.email}}": "Email do participante",
};
